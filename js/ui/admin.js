// File: js/ui/admin.js

import { doc, deleteDoc, updateDoc, addDoc, serverTimestamp, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, getGradesCollection } from '../config/firebase.js';
import { USERS_DB, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { MASTER_CLASSES, MASTER_SUBJECTS, MASTER_TAHUN, saveMasterData } from '../services/db-master.js';
import { renderTableGuru, renderTableSiswa, gradesData, renderMasterDataUI, populateDropdowns } from './tables.js';
import { writeLog } from '../services/audit.js';

export function setupAdminEvents() {
    
    // --- FITUR BARU: MASTER DATA TAHUN AJARAN ---
    const btnAddTahun = document.getElementById('btn-add-master-tahun');
    if(btnAddTahun) {
        btnAddTahun.onclick = async () => {
            const val = document.getElementById('in-master-tahun').value.trim();
            if(!val) return;
            if(!val.includes('/')) {
                if(!confirm("Format biasanya menggunakan garis miring (cth: 2028/2029). Tetap simpan?")) return;
            }
            if(!MASTER_TAHUN.includes(val)) {
                MASTER_TAHUN.push(val);
                try {
                    await saveMasterData();
                    document.getElementById('in-master-tahun').value = '';
                    renderMasterDataUI();
                    populateDropdowns(); 
                } catch(e) { alert("Gagal menyimpan tahun ajaran baru."); MASTER_TAHUN.pop(); }
            }
        };
    }

    // --- FITUR SALIN SISWA (KENAIKAN KELAS) ---
    const btnCopySiswa = document.getElementById('btn-copy-siswa');
    if (btnCopySiswa) {
        btnCopySiswa.onclick = async () => {
            const thnAsal = document.getElementById('copy-tahun-asal').value;
            const clsAsal = document.getElementById('copy-class-asal').value;
            const clsTujuan = document.getElementById('copy-class-tujuan').value;
            const thnAktif = getActiveTahun();
            const smtAktif = getActiveSemester();

            if (!thnAsal || !clsAsal || !clsTujuan) { alert("Mohon pilih Tahun Asal, Kelas Asal, dan Kelas Tujuan terlebih dahulu."); return; }

            if (confirm(`Salin siswa dari kelas ${clsAsal} (${thnAsal}) ke kelas ${clsTujuan} untuk periode berjalan (${thnAktif} - ${smtAktif})?`)) {
                const sourceData = gradesData.filter(g => g.tahun === thnAsal && g.className === clsAsal);
                const map = new Map();
                sourceData.forEach(g => {
                    const key = g.studentName + "_" + (g.nisn || '');
                    if (!map.has(key)) map.set(key, { name: g.studentName, nisn: g.nisn });
                });
                
                const studentsToCopy = Array.from(map.values());
                if (studentsToCopy.length === 0) { alert(`Tidak ada siswa di kelas ${clsAsal} pada tahun ${thnAsal}.`); return; }

                btnCopySiswa.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i> Sedang Menyalin...';
                btnCopySiswa.disabled = true;

                try {
                    let currentBatch = writeBatch(db);
                    let opCount = 0;
                    const commitPromises = [];

                    for (const s of studentsToCopy) {
                        for (const mapel of MASTER_SUBJECTS) {
                            const newDocRef = doc(getGradesCollection());
                            currentBatch.set(newDocRef, {
                                studentName: s.name, nisn: s.nisn, teacherName: 'admin', subject: mapel, className: clsTujuan, 
                                tahun: thnAktif, semester: smtAktif, 
                                scores: { f1:null, f2:null, f3:null, t1:null, t2:null, t3:null, asaj:null }, 
                                results: { avgFormative:0, avgTask:0, final:0 }, createdAt: serverTimestamp()
                            });
                            opCount++;
                            if (opCount >= 450) { 
                                commitPromises.push(currentBatch.commit());
                                currentBatch = writeBatch(db);
                                opCount = 0;
                            }
                        }
                    }
                    if (opCount > 0) commitPromises.push(currentBatch.commit());
                    await Promise.all(commitPromises);

                    await writeLog("SALIN_SISWA", `Menyalin ${studentsToCopy.length} siswa dari ${clsAsal} ke ${clsTujuan}.`);
                    alert(`Sukses! ${studentsToCopy.length} siswa berhasil dinaikkan/disalin ke kelas ${clsTujuan}.`);
                    renderTableSiswa();
                } catch (err) { alert("Terjadi kesalahan sistem saat menyalin data."); } 
                finally {
                    btnCopySiswa.innerHTML = '<i class="ph ph-arrow-circle-right text-lg"></i> Proses Salin';
                    btnCopySiswa.disabled = false;
                }
            }
        };
    }

    // --- SISANYA TETAP SAMA ---
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
                    renderTableSiswa();
                } catch(err) { alert("Format Excel salah."); }
                e.target.value = null;
            };
            reader.readAsArrayBuffer(file);
        };
    }

    const filterKelasSiswa = document.getElementById('crud-siswa-kelas-filter');
    if (filterKelasSiswa) {
        filterKelasSiswa.addEventListener('change', () => { renderTableSiswa(); });
    }

    const btnDeleteClass = document.getElementById('btn-delete-class');
    const deleteClassSelect = document.getElementById('delete-class-select');
    if (deleteClassSelect && btnDeleteClass) {
        deleteClassSelect.addEventListener('change', (e) => {
            if(e.target.value) {
                btnDeleteClass.disabled = false;
                btnDeleteClass.classList.replace('bg-gray-300', 'bg-red-600');
            } else {
                btnDeleteClass.disabled = true;
                btnDeleteClass.classList.replace('bg-red-600', 'bg-gray-300');
            }
        });

        btnDeleteClass.onclick = async () => {
            const cls = deleteClassSelect.value;
            const thn = getActiveTahun();
            const smt = getActiveSemester();
            if(!cls) return;

            if(!confirm(`Yakin ingin MENGHAPUS SEMUA DATA nilai kelas ${cls} periode ${thn} ${smt}?`)) return;

            try {
                const docsToDelete = gradesData.filter(g => g.className === cls && g.tahun === thn && g.semester === smt);
                if (docsToDelete.length === 0) { alert("Data tidak ditemukan."); return; }

                btnDeleteClass.textContent = "MENGHAPUS...";
                const batch = writeBatch(db);
                docsToDelete.forEach(d => batch.delete(doc(getGradesCollection(), d.id)));
                await batch.commit();

                await writeLog("HAPUS_KELAS_MASAL", `Menghapus data kelas ${cls}.`);
                alert(`Berhasil menghapus ${docsToDelete.length} data.`);
                deleteClassSelect.value = '';
                btnDeleteClass.disabled = true;
                btnDeleteClass.textContent = "EKSEKUSI PENGHAPUSAN";
                renderTableSiswa();
            } catch (err) { alert("Gagal menghapus."); }
        };
    }

    const btnResetSiswa = document.getElementById('btn-reset-siswa');
    if (btnResetSiswa) {
        btnResetSiswa.onclick = async () => {
            if(!confirm("PERINGATAN BAHAYA: Anda yakin ingin MENGHAPUS SELURUH DATA SISWA secara permanen? Data yang dihapus tidak bisa dikembalikan!")) return;
            const pass = prompt("Untuk melanjutkan, ketik kata: HAPUS");
            if (pass !== "HAPUS") { alert("Proses dibatalkan."); return; }

            try {
                btnResetSiswa.innerHTML = '<i class="ph ph-spinner animate-spin text-xl"></i> SEDANG MENGHAPUS...';
                btnResetSiswa.disabled = true;

                const snapshot = await getDocs(getGradesCollection());
                if (snapshot.empty) {
                    alert("Database siswa sudah dalam keadaan kosong.");
                    btnResetSiswa.innerHTML = '<i class="ph ph-users-three text-xl"></i> Kosongkan Data Siswa';
                    btnResetSiswa.disabled = false;
                    return;
                }

                let batches = [];
                let currentBatch = writeBatch(db);
                let count = 0;
                snapshot.docs.forEach(d => {
                    currentBatch.delete(d.ref);
                    count++;
                    if (count === 500) { batches.push(currentBatch.commit()); currentBatch = writeBatch(db); count = 0; }
                });
                if (count > 0) batches.push(currentBatch.commit());
                await Promise.all(batches); 

                await writeLog("RESET_DATA_SISWA", `Admin mengosongkan seluruh database siswa.`);
                alert(`Selesai! Sebanyak ${snapshot.docs.length} dokumen siswa berhasil dibersihkan dari server.`);
                btnResetSiswa.innerHTML = '<i class="ph ph-users-three text-xl"></i> Kosongkan Data Siswa';
                btnResetSiswa.disabled = false;
                renderTableSiswa(); 
            } catch (err) {
                alert("Terjadi kesalahan saat menghapus data.");
                btnResetSiswa.innerHTML = '<i class="ph ph-users-three text-xl"></i> Kosongkan Data Siswa';
                btnResetSiswa.disabled = false;
            }
        };
    }

    const btnResetDb = document.getElementById('btn-reset-db');
    if (btnResetDb) {
        btnResetDb.onclick = async () => {
            if(!confirm("Reset seluruh database sekolah? (Termasuk data guru dan pengaturan)")) return;
            await writeLog("RESET_DATABASE", "Request reset total database.");
            alert("Tindakan dicatat di Log Audit. Untuk keamanan, hapus seluruh data master & guru dilakukan manual di Firebase Console.");
        };
    }
}

// ========================================================
// GLOBAL: Delete Master Tahun
// ========================================================
window.deleteMasterTahun = async (idx) => {
    if(!confirm("Hapus tahun ajaran tambahan ini?")) return;
    const removed = MASTER_TAHUN.splice(idx, 1);
    try {
        await saveMasterData();
        renderMasterDataUI();
        populateDropdowns(); 
    } catch(e) {
        MASTER_TAHUN.splice(idx, 0, removed[0]); // Kembalikan jika gagal
        alert("Gagal menghapus tahun.");
    }
};

window.editSiswa = async (encN, encI, encC) => {
    const oldName = decodeURIComponent(encN);
    const oldNisn = decodeURIComponent(encI);
    const studentClass = decodeURIComponent(encC);
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    const newName = prompt("Edit Nama Lengkap Siswa:", oldName);
    if(!newName || newName.trim() === '') return;
    const newNisn = prompt("Edit NISN:", oldNisn) || "";

    try {
        const docsToUpdate = gradesData.filter(g =>
            g.className === studentClass && g.tahun === thn && g.semester === smt &&
            g.studentName === oldName && (g.nisn || '') === oldNisn
        );

        if(docsToUpdate.length > 0) {
            const batch = writeBatch(db);
            docsToUpdate.forEach(d => {
                batch.update(doc(getGradesCollection(), d.id), { studentName: newName, nisn: newNisn, updatedAt: serverTimestamp() });
            });
            await batch.commit();
            alert(`Siswa ${oldName} berhasil diupdate!`);
            renderTableSiswa();
        }
    } catch(err) { alert("Gagal update."); }
};

window.deleteSiswa = async (encN, encI, encC) => {
    const name = decodeURIComponent(encN);
    const nisn = decodeURIComponent(encI);
    const studentClass = decodeURIComponent(encC);
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    if(!confirm(`Hapus seluruh data nilai "${name}" di kelas ${studentClass}?`)) return;

    try {
        const docsToDelete = gradesData.filter(g =>
            g.className === studentClass && g.tahun === thn && g.semester === smt &&
            g.studentName === name && (g.nisn || '') === nisn
        );

        if(docsToDelete.length > 0) {
            const batch = writeBatch(db);
            docsToDelete.forEach(d => batch.delete(doc(getGradesCollection(), d.id)));
            await batch.commit();
            alert(`Data ${name} dihapus.`);
            renderTableSiswa();
        }
    } catch(err) { alert("Gagal hapus."); }
};
