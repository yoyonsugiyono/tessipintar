// File: js/ui/admin.js

import { doc, deleteDoc, updateDoc, addDoc, serverTimestamp, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, getGradesCollection } from '../config/firebase.js';
import { USERS_DB, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { MASTER_CLASSES, MASTER_SUBJECTS, MASTER_TAHUN, saveMasterData } from '../services/db-master.js';
import { renderTableGuru, renderTableSiswa, gradesData, renderMasterDataUI, populateDropdowns } from './tables.js';
import { writeLog } from '../services/audit.js';

export function setupAdminEvents() {
    
    // --- FITUR BARU: EXPORT / IMPORT MASTER DATA VIA EXCEL ---
    const btnTemplateMaster = document.getElementById('btn-template-master');
    if (btnTemplateMaster) {
        btnTemplateMaster.onclick = () => {
            const wsTahun = XLSX.utils.json_to_sheet([{ "Tahun": "2028/2029" }, { "Tahun": "2029/2030" }]);
            const wsKelas = XLSX.utils.json_to_sheet([{ "Kelas": "X-1" }, { "Kelas": "X-2" }]);
            const wsMapel = XLSX.utils.json_to_sheet([{ "Mata Pelajaran": "Bahasa Indonesia" }, { "Mata Pelajaran": "Matematika" }]);
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, wsTahun, "Tahun Ajaran");
            XLSX.utils.book_append_sheet(wb, wsKelas, "Daftar Kelas");
            XLSX.utils.book_append_sheet(wb, wsMapel, "Daftar Mapel");
            
            XLSX.writeFile(wb, "Format_Master_Data.xlsx");
        };
    }

    const importXlsxMaster = document.getElementById('import-xlsx-master');
    if (importXlsxMaster) {
        importXlsxMaster.onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    
                    let countTahun = 0, countKelas = 0, countMapel = 0;

                    if (workbook.SheetNames.includes("Tahun Ajaran")) {
                        const jsonTahun = XLSX.utils.sheet_to_json(workbook.Sheets["Tahun Ajaran"]);
                        jsonTahun.forEach(row => {
                            const val = String(row["Tahun"] || "").trim();
                            if (val && !MASTER_TAHUN.includes(val)) { MASTER_TAHUN.push(val); countTahun++; }
                        });
                    }

                    if (workbook.SheetNames.includes("Daftar Kelas")) {
                        const jsonKelas = XLSX.utils.sheet_to_json(workbook.Sheets["Daftar Kelas"]);
                        jsonKelas.forEach(row => {
                            const val = String(row["Kelas"] || "").trim();
                            if (val && !MASTER_CLASSES.includes(val)) { MASTER_CLASSES.push(val); countKelas++; }
                        });
                    }

                    if (workbook.SheetNames.includes("Daftar Mapel")) {
                        const jsonMapel = XLSX.utils.sheet_to_json(workbook.Sheets["Daftar Mapel"]);
                        jsonMapel.forEach(row => {
                            const val = String(row["Mata Pelajaran"] || "").trim();
                            if (val && !MASTER_SUBJECTS.includes(val)) { MASTER_SUBJECTS.push(val); countMapel++; }
                        });
                    }

                    if (countTahun > 0 || countKelas > 0 || countMapel > 0) {
                        await saveMasterData();
                        renderMasterDataUI();
                        populateDropdowns();
                        await writeLog("IMPORT_MASTER", `Mengimpor ${countTahun} Tahun, ${countKelas} Kelas, ${countMapel} Mapel.`);
                        alert(`Berhasil mengimpor data baru:\n- ${countTahun} Tahun Ajaran\n- ${countKelas} Kelas\n- ${countMapel} Mata Pelajaran`);
                    } else {
                        alert("Tidak ada data baru yang ditambahkan (mungkin format kosong atau data sudah ada).");
                    }
                } catch(err) { 
                    console.error("Gagal parse Master XLSX:", err);
                    alert("Format Excel salah atau terjadi kesalahan sistem."); 
                }
                e.target.value = null; // Reset input file
            };
            reader.readAsArrayBuffer(file);
        };
    }

    // --- FITUR TAMBAH MASTER DATA MANUAL (INPUT TEKS) ---
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
                    renderMasterDataUI(); populateDropdowns();
                } catch(e) { alert("Gagal menyimpan."); MASTER_TAHUN.pop(); }
            }
        };
    }

    const btnAddClass = document.getElementById('btn-add-master-class');
    if(btnAddClass) {
        btnAddClass.onclick = async () => {
            const val = document.getElementById('in-master-class').value.trim();
            if(!val) return;
            if(!MASTER_CLASSES.includes(val)) {
                MASTER_CLASSES.push(val);
                try {
                    await saveMasterData();
                    document.getElementById('in-master-class').value = '';
                    renderMasterDataUI(); populateDropdowns();
                } catch(e) { alert("Gagal menyimpan."); MASTER_CLASSES.pop(); }
            }
        };
    }

    const btnAddSubject = document.getElementById('btn-add-master-subject');
    if(btnAddSubject) {
        btnAddSubject.onclick = async () => {
            const val = document.getElementById('in-master-subject').value.trim();
            if(!val) return;
            if(!MASTER_SUBJECTS.includes(val)) {
                MASTER_SUBJECTS.push(val);
                try {
                    await saveMasterData();
                    document.getElementById('in-master-subject').value = '';
                    renderMasterDataUI(); populateDropdowns();
                } catch(e) { alert("Gagal menyimpan."); MASTER_SUBJECTS.pop(); }
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
                            currentBatch.set(doc(getGradesCollection()), {
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

    // --- IMPORT, EXPORT, HAPUS KELAS, DLL ---
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
// GLOBAL: Hapus Master Data (Tahun, Kelas, Mapel)
// ========================================================
window.deleteMasterTahun = async (idx) => {
    if(!confirm("Hapus tahun ajaran tambahan ini?")) return;
    const removed = MASTER_TAHUN.splice(idx, 1);
    try { await saveMasterData(); renderMasterDataUI(); populateDropdowns(); }
    catch(e) { MASTER_TAHUN.splice(idx, 0, removed[0]); alert("Gagal menghapus."); }
};

window.deleteMasterClass = async (idx) => {
    if(!confirm("Hapus kelas ini dari master data?")) return;
    const removed = MASTER_CLASSES.splice(idx, 1);
    try { await saveMasterData(); renderMasterDataUI(); populateDropdowns(); }
    catch(e) { MASTER_CLASSES.splice(idx, 0, removed[0]); alert("Gagal menghapus."); }
};

window.deleteMasterSubject = async (idx) => {
    if(!confirm("Hapus mata pelajaran ini dari master data?")) return;
    const removed = MASTER_SUBJECTS.splice(idx, 1);
    try { await saveMasterData(); renderMasterDataUI(); populateDropdowns(); }
    catch(e) { MASTER_SUBJECTS.splice(idx, 0, removed[0]); alert("Gagal menghapus."); }
};

// ========================================================
// GLOBAL: Edit / Hapus Siswa Individual
// ========================================================
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
