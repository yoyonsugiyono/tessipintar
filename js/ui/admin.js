// File: js/ui/admin.js

import { doc, deleteDoc, updateDoc, addDoc, getDocs, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, getUsersCollection, getGradesCollection, getSettingsCollection } from '../config/firebase.js';
import { USERS_DB, loadUsersFromDB, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { MASTER_CLASSES, MASTER_SUBJECTS, saveMasterData } from '../services/db-master.js';
import { renderTableGuru, renderTableSiswa, renderMasterDataUI, populateDropdowns, gradesData } from './tables.js';
import { writeLog } from '../services/audit.js';

export function setupAdminEvents() {
    // A. Download Data Siswa Berbasis Database
    const btnTemplateSiswa = document.getElementById('btn-template-siswa');
    if (btnTemplateSiswa) {
        btnTemplateSiswa.onclick = () => {
            const cls = document.getElementById('import-class-select').value;
            const thn = getActiveTahun();
            const smt = getActiveSemester();

            const clsData = gradesData.filter(g => g.className === cls && g.tahun === thn && g.semester === smt);
            const map = new Map();
            clsData.forEach(g => {
                const key = g.studentName + "_" + (g.nisn || '');
                if (!map.has(key)) map.set(key, { "Nama Siswa": g.studentName, "NISN": g.nisn || "", "Kelas": g.className });
            });
            
            let dataToExport = Array.from(map.values());
            if (dataToExport.length === 0) dataToExport = [{ "Nama Siswa": "Contoh Nama", "NISN": "000000", "Kelas": cls || "X-1" }];

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DataSiswa");
            XLSX.writeFile(wb, `Data_Siswa_${cls || 'Semua'}.xlsx`);
        };
    }

    // B. Download Data Guru Berbasis Database
    const btnTemplateGuru = document.getElementById('btn-template-guru');
    if (btnTemplateGuru) {
        btnTemplateGuru.onclick = () => {
            const dataToExport = USERS_DB.map(u => ({ "Username": u.username, "Role": u.role, "Password": u.password }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DataGuru");
            XLSX.writeFile(wb, "Data_Akun_Guru.xlsx");
        };
    }

    // C. Import Siswa Masal (Otomatis Mapel)
    const importXlsxSiswa = document.getElementById('import-xlsx-siswa');
    if (importXlsxSiswa) {
        importXlsxSiswa.onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    let count = 0;
                    for(let row of json) {
                        let n = String(row["Nama Siswa"] || "").trim();
                        let cls = String(row["Kelas"] || "").trim();
                        if(!n || !cls) continue;
                        for(const s of MASTER_SUBJECTS) {
                            await addDoc(getGradesCollection(), { 
                                studentName: n, nisn: String(row["NISN"] || ""), teacherName: 'admin', subject: s, className: cls, 
                                tahun: getActiveTahun(), semester: getActiveSemester(), 
                                scores: { f1:null, f2:null, f3:null, t1:null, t2:null, t3:null, asaj:null }, 
                                results: { avgFormative:0, avgTask:0, final:0 }, createdAt: serverTimestamp() 
                            });
                        }
                        count++;
                    }
                    alert(`Impor ${count} siswa berhasil!`);
                    renderTableSiswa(); // Refresh tabel otomatis
                } catch(err) { alert("Format Excel salah."); }
                e.target.value = null;
            };
            reader.readAsArrayBuffer(file);
        };
    }

    // D. Listener Dropdown Kelas untuk Render Tabel Siswa
    const filterKelasSiswa = document.getElementById('crud-siswa-kelas-filter');
    if (filterKelasSiswa) {
        // Ketika admin memilih kelas, paksa tabel untuk merender ulang datanya
        filterKelasSiswa.addEventListener('change', () => {
            renderTableSiswa();
        });
    }

    // E. Fitur Hapus Kelas Masal
    const btnDeleteClass = document.getElementById('btn-delete-class');
    const deleteClassSelect = document.getElementById('delete-class-select');
    
    if (deleteClassSelect && btnDeleteClass) {
        deleteClassSelect.addEventListener('change', (e) => {
            if(e.target.value) {
                btnDeleteClass.disabled = false;
                btnDeleteClass.classList.remove('bg-gray-200', 'cursor-not-allowed', 'text-gray-500');
                btnDeleteClass.classList.add('bg-red-600', 'hover:bg-red-700', 'text-white');
            } else {
                btnDeleteClass.disabled = true;
                btnDeleteClass.classList.add('bg-gray-200', 'cursor-not-allowed', 'text-gray-500');
                btnDeleteClass.classList.remove('bg-red-600', 'hover:bg-red-700', 'text-white');
            }
        });

        btnDeleteClass.onclick = async () => {
            const cls = deleteClassSelect.value;
            const thn = getActiveTahun();
            const smt = getActiveSemester();
            
            if(!cls) return;
            if(!confirm(`PERINGATAN! Anda yakin ingin MENGHAPUS SEMUA DATA nilai siswa kelas ${cls} pada periode ${thn} ${smt}? Data tidak dapat dikembalikan!`)) return;

            try {
                const docsToDelete = gradesData.filter(g => g.className === cls && g.tahun === thn && g.semester === smt);
                
                if (docsToDelete.length === 0) {
                    alert(`Tidak ada data ditemukan untuk kelas ${cls}.`);
                    return;
                }

                btnDeleteClass.textContent = "MENGHAPUS...";
                
                // Hapus masal menggunakan Batch untuk performa & keamanan
                const batch = writeBatch(db);
                docsToDelete.forEach(d => {
                    const ref = doc(getGradesCollection(), d.id);
                    batch.delete(ref);
                });
                await batch.commit();

                await writeLog("HAPUS_KELAS_MASAL", `Menghapus seluruh data kelas ${cls} pada periode aktif.`);
                
                alert(`Berhasil menghapus ${docsToDelete.length} data kelas ${cls}.`);
                deleteClassSelect.value = '';
                btnDeleteClass.disabled = true;
                btnDeleteClass.textContent = "EKSEKUSI PENGHAPUSAN";
                renderTableSiswa(); // Refresh tabel siswa jika sedang terbuka
                
            } catch (err) {
                console.error("Gagal menghapus kelas:", err);
                alert("Terjadi kesalahan saat menghapus data.");
                btnDeleteClass.textContent = "EKSEKUSI PENGHAPUSAN";
            }
        };
    }

    // F. Tombol Reset Database Total
    const btnResetDb = document.getElementById('btn-reset-db');
    if (btnResetDb) {
        btnResetDb.onclick = async () => {
            if(!confirm("BAHAYA: Apakah Anda benar-benar yakin ingin mereset seluruh database?")) return;
            try {
                await writeLog("RESET_DATABASE", "Melakukan permintaan reset total database sekolah.");
                alert("Tindakan dicatat di Log Audit. Untuk keamanan tingkat tinggi, hapus seluruh data hanya bisa dilakukan langsung melalui Firebase Console.");
            } catch (err) {
                console.error(err);
            }
        };
    }
}

// ========================================================
// FUNGSI GLOBAL: Edit Identitas Siswa oleh Admin
// ========================================================
window.editSiswa = async (encN, encI) => {
    const oldName = decodeURIComponent(encN);
    const oldNisn = decodeURIComponent(encI);
    const cls = document.getElementById('crud-siswa-kelas-filter').value;
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    const newName = prompt("Edit Nama Lengkap Siswa:", oldName);
    if(!newName || newName.trim() === '') return;
    const newNisn = prompt("Edit NISN (Kosongkan jika tidak ada):", oldNisn) || "";

    if(newName === oldName && newNisn === oldNisn) return; // Tidak ada perubahan

    try {
        // Cari semua dokumen mapel (baris nilai) milik anak ini
        const docsToUpdate = gradesData.filter(g =>
            g.className === cls && g.tahun === thn && g.semester === smt &&
            g.studentName === oldName && (g.nisn || '') === oldNisn
        );

        if(docsToUpdate.length > 0) {
            // Gunakan Batch Update agar nama siswa berubah serentak di SEMUA MATA PELAJARAN
            const batch = writeBatch(db);
            docsToUpdate.forEach(d => {
                const ref = doc(getGradesCollection(), d.id);
                batch.update(ref, { studentName: newName, nisn: newNisn, updatedAt: serverTimestamp() });
            });
            await batch.commit();
            alert(`Data siswa ${oldName} berhasil diupdate di semua mata pelajaran!`);
            renderTableSiswa(); // Refresh tabel
        }
    } catch(err) {
        console.error("Gagal update siswa:", err);
        alert("Terjadi kesalahan saat menyimpan perubahan.");
    }
};

// ========================================================
// FUNGSI GLOBAL: Hapus Siswa oleh Admin
// ========================================================
window.deleteSiswa = async (encN, encI) => {
    const name = decodeURIComponent(encN);
    const nisn = decodeURIComponent(encI);
    const cls = document.getElementById('crud-siswa-kelas-filter').value;
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    if(!confirm(`Peringatan! Yakin ingin MENGHAPUS SELURUH rekap nilai untuk siswa "${name}" di kelas ${cls}? Data yang dihapus tidak dapat dikembalikan!`)) return;

    try {
        const docsToDelete = gradesData.filter(g =>
            g.className === cls && g.tahun === thn && g.semester === smt &&
            g.studentName === name && (g.nisn || '') === nisn
        );

        if(docsToDelete.length > 0) {
            // Gunakan Batch Delete untuk menghapus siswa dari SEMUA MATA PELAJARAN sekaligus
            const batch = writeBatch(db);
            docsToDelete.forEach(d => {
                const ref = doc(getGradesCollection(), d.id);
                batch.delete(ref);
            });
            await batch.commit();
            alert(`Semua data nilai atas nama ${name} berhasil dihapus.`);
            renderTableSiswa(); // Refresh tabel
        }
    } catch(err) {
        console.error("Gagal menghapus siswa:", err);
        alert("Terjadi kesalahan saat mencoba menghapus data.");
    }
};
