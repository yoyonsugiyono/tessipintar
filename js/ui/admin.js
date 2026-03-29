// File: js/ui/admin.js

import { doc, deleteDoc, updateDoc, addDoc, serverTimestamp, writeBatch, getDocs, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, getGradesCollection } from '../config/firebase.js';
import { USERS_DB, getActiveTahun, getActiveSemester, getAppUser } from '../services/auth.js';
import { MASTER_CLASSES, MASTER_SUBJECTS, MASTER_TAHUN, saveMasterData } from '../services/db-master.js';
import { renderTableGuru, renderTableSiswa, gradesData, renderMasterDataUI, populateDropdowns } from './tables.js';
import { writeLog } from '../services/audit.js';

export function setupAdminEvents() {
    
    // ========================================================
    // 0. KELOLA PENGGUNA: TAMBAH GURU (CRUD LENGKAP)
    // ========================================================
    const btnAddGuru = document.getElementById('btn-add-guru');
    if (btnAddGuru) {
        btnAddGuru.onclick = async () => {
            const username = prompt("Masukkan Nama Lengkap (Username) pengguna baru:");
            if (!username) return;
            
            const password = prompt(`Masukkan Password untuk "${username}":`, "123456");
            if (!password) return;
            
            const role = prompt("Masukkan Role Akses Sistem (Ketik: guru / wakasek / admin):", "guru");
            if (!role || !['guru', 'wakasek', 'admin'].includes(role.toLowerCase())) {
                alert("Proses dibatalkan. Role tidak valid! Harus diisi: guru, wakasek, atau admin."); return;
            }

            btnAddGuru.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i> Menyimpan...';
            btnAddGuru.disabled = true;

            try {
                const usersRef = collection(db, 'users');
                await addDoc(usersRef, {
                    username: username,
                    password: password,
                    role: role.toLowerCase(),
                    jabatan: role.toLowerCase() === 'admin' ? 'Administrator' : 'Guru Mapel',
                    waliKelas: '',
                    createdAt: serverTimestamp()
                });
                
                renderTableGuru(); // Panggil ulang data dari database
                await writeLog("TAMBAH_PENGGUNA", `Admin membuat akun baru: ${username} (${role})`);
                alert(`Berhasil! Pengguna "${username}" telah ditambahkan ke database.`);
            } catch(e) {
                console.error(e);
                alert("Gagal menambahkan pengguna. Pastikan koneksi internet Anda lancar.");
            } finally {
                btnAddGuru.innerHTML = '<i class="ph ph-user-plus text-lg"></i> Tambah Pengguna Baru';
                btnAddGuru.disabled = false;
            }
        };
    }

    // ========================================================
    // 1. MASTER DATA: EXPORT & IMPORT VIA EXCEL
    // ========================================================
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
    const labelXlsxMaster = document.getElementById('label-xlsx-master');
    const btnProcessMaster = document.getElementById('btn-process-master');
    let selectedMasterFile = null;

    if (importXlsxMaster && btnProcessMaster) {
        importXlsxMaster.onchange = (e) => {
            selectedMasterFile = e.target.files[0];
            if (selectedMasterFile) {
                if (labelXlsxMaster) labelXlsxMaster.innerHTML = `<span class="text-purple-800 font-bold text-sm bg-purple-100 px-3 py-1 rounded-full border border-purple-200">${selectedMasterFile.name}</span>`;
                btnProcessMaster.classList.remove('hidden');
            } else {
                if (labelXlsxMaster) labelXlsxMaster.textContent = "Pilih File Master (.xlsx)";
                btnProcessMaster.classList.add('hidden');
            }
        };

        btnProcessMaster.onclick = () => {
            if (!selectedMasterFile) return;
            btnProcessMaster.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i> Sedang Memproses...';
            btnProcessMaster.disabled = true;

            const reader = new FileReader();
            const resetMasterUploadUI = () => {
                importXlsxMaster.value = null; selectedMasterFile = null;
                if (labelXlsxMaster) labelXlsxMaster.textContent = "Pilih File Master (.xlsx)";
                btnProcessMaster.classList.add('hidden');
                btnProcessMaster.innerHTML = '<i class="ph ph-check-circle text-lg"></i> Simpan & Proses Data';
                btnProcessMaster.disabled = false;
            };

            reader.onload = async (ev) => {
                let countTahun = 0, countKelas = 0, countMapel = 0;
                let parsedTahun = [], parsedKelas = [], parsedMapel = [];

                try {
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    
                    if (workbook.SheetNames.includes("Tahun Ajaran")) {
                        const jsonTahun = XLSX.utils.sheet_to_json(workbook.Sheets["Tahun Ajaran"]);
                        jsonTahun.forEach(row => { const val = String(row["Tahun"] || "").trim(); if (val && !MASTER_TAHUN.includes(val) && !parsedTahun.includes(val)) parsedTahun.push(val); });
                    }
                    if (workbook.SheetNames.includes("Daftar Kelas")) {
                        const jsonKelas = XLSX.utils.sheet_to_json(workbook.Sheets["Daftar Kelas"]);
                        jsonKelas.forEach(row => { const val = String(row["Kelas"] || "").trim(); if (val && !MASTER_CLASSES.includes(val) && !parsedKelas.includes(val)) parsedKelas.push(val); });
                    }
                    if (workbook.SheetNames.includes("Daftar Mapel")) {
                        const jsonMapel = XLSX.utils.sheet_to_json(workbook.Sheets["Daftar Mapel"]);
                        jsonMapel.forEach(row => { const val = String(row["Mata Pelajaran"] || "").trim(); if (val && !MASTER_SUBJECTS.includes(val) && !parsedMapel.includes(val)) parsedMapel.push(val); });
                    }
                    countTahun = parsedTahun.length; countKelas = parsedKelas.length; countMapel = parsedMapel.length;
                } catch(err) { 
                    alert("ERROR: Gagal membaca file Excel. Pastikan file tidak rusak dan format sesuai template."); 
                    resetMasterUploadUI(); return;
                }

                if (countTahun > 0 || countKelas > 0 || countMapel > 0) {
                    try {
                        parsedTahun.forEach(v => MASTER_TAHUN.push(v)); parsedKelas.forEach(v => MASTER_CLASSES.push(v)); parsedMapel.forEach(v => MASTER_SUBJECTS.push(v));
                        await saveMasterData(); renderMasterDataUI(); populateDropdowns();
                        try { await writeLog("IMPORT_MASTER", `Mengimpor ${countTahun} Tahun, ${countKelas} Kelas, ${countMapel} Mapel.`); } catch(e){}
                        alert(`Berhasil mengimpor data baru:\n- ${countTahun} Tahun Ajaran\n- ${countKelas} Kelas\n- ${countMapel} Mata Pelajaran`);
                    } catch(dbErr) {
                        parsedTahun.forEach(() => MASTER_TAHUN.pop()); parsedKelas.forEach(() => MASTER_CLASSES.pop()); parsedMapel.forEach(() => MASTER_SUBJECTS.pop());
                        alert("ERROR DATABASE: Gagal menyimpan data ke server.");
                    }
                } else { alert("Tidak ada data baru yang ditambahkan."); }
                resetMasterUploadUI();
            };
            reader.onerror = () => { alert("ERROR: Browser gagal membaca file."); resetMasterUploadUI(); };
            reader.readAsArrayBuffer(selectedMasterFile);
        };
    }

    // ========================================================
    // 2. MASTER DATA: TAMBAH MANUAL (INPUT TEKS)
    // ========================================================
    const btnAddTahun = document.getElementById('btn-add-master-tahun');
    if(btnAddTahun) {
        btnAddTahun.onclick = async () => {
            const val = document.getElementById('in-master-tahun').value.trim();
            if(!val) return;
            if(!val.includes('/')) { if(!confirm("Format biasanya menggunakan garis miring (cth: 2028/2029). Tetap simpan?")) return; }
            if(!MASTER_TAHUN.includes(val)) {
                MASTER_TAHUN.push(val);
                try { await saveMasterData(); document.getElementById('in-master-tahun').value = ''; renderMasterDataUI(); populateDropdowns(); }
                catch(e) { alert("Gagal menyimpan."); MASTER_TAHUN.pop(); }
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
                try { await saveMasterData(); document.getElementById('in-master-class').value = ''; renderMasterDataUI(); populateDropdowns(); }
                catch(e) { alert("Gagal menyimpan."); MASTER_CLASSES.pop(); }
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
                try { await saveMasterData(); document.getElementById('in-master-subject').value = ''; renderMasterDataUI(); populateDropdowns(); }
                catch(e) { alert("Gagal menyimpan."); MASTER_SUBJECTS.pop(); }
            }
        };
    }

    // ========================================================
    // 3. KELOLA SISWA: NAIK KELAS / SALIN SISWA
    // ========================================================
    const btnCopySiswa = document.getElementById('btn-copy-siswa');
    if (btnCopySiswa) {
        btnCopySiswa.onclick = async () => {
            const appUser = getAppUser();
            const thnAsal = document.getElementById('copy-tahun-asal').value;
            const clsAsal = document.getElementById('copy-class-asal').value;
            const clsTujuan = document.getElementById('copy-class-tujuan').value;
            const thnAktif = getActiveTahun();
            const smtAktif = getActiveSemester();

            if (!thnAsal || !clsAsal || !clsTujuan) { alert("Pilih Tahun Asal, Kelas Asal, dan Kelas Tujuan terlebih dahulu."); return; }

            if (appUser.role !== 'admin' && appUser.jabatan === 'Wali Kelas' && appUser.waliKelas && clsTujuan !== appUser.waliKelas) {
                alert(`AKSES DITOLAK: Anda menjabat sebagai Wali Kelas ${appUser.waliKelas}. Anda tidak berhak menyalin data ke kelas ${clsTujuan}.`); return;
            }

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
                                tahun: thnAktif, semester: smtAktif, scores: { f1:null, f2:null, f3:null, t1:null, t2:null, t3:null, asaj:null }, 
                                results: { avgFormative:0, avgTask:0, final:0 }, createdAt: serverTimestamp()
                            });
                            opCount++;
                            if (opCount >= 450) { commitPromises.push(currentBatch.commit()); currentBatch = writeBatch(db); opCount = 0; }
                        }
                    }
                    if (opCount > 0) commitPromises.push(currentBatch.commit());
                    await Promise.all(commitPromises);

                    await writeLog("SALIN_SISWA", `${appUser.username} menyalin ${studentsToCopy.length} siswa dari ${clsAsal} ke ${clsTujuan}.`);
                    alert(`Sukses! ${studentsToCopy.length} siswa berhasil dinaikkan/disalin ke kelas ${clsTujuan}.`);
                    renderTableSiswa();
                } catch (err) { alert("Terjadi kesalahan sistem saat menyalin data."); } 
                finally { btnCopySiswa.innerHTML = '<i class="ph ph-arrow-circle-right text-lg"></i> Proses Salin'; btnCopySiswa.disabled = false; }
            }
        };
    }

    // ========================================================
    // 4. KELOLA SISWA: EXPORT & IMPORT VIA EXCEL
    // ========================================================
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

    const importXlsxSiswa = document.getElementById('import-xlsx-siswa');
    const labelXlsxSiswa = document.getElementById('label-xlsx-siswa');
    const btnProcessSiswa = document.getElementById('btn-process-siswa');
    let selectedSiswaFile = null;

    if (importXlsxSiswa && btnProcessSiswa) {
        importXlsxSiswa.onchange = (e) => {
            selectedSiswaFile = e.target.files[0];
            if (selectedSiswaFile) {
                if (labelXlsxSiswa) labelXlsxSiswa.innerHTML = `<span class="text-emerald-800 font-bold text-sm bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">${selectedSiswaFile.name}</span>`;
                btnProcessSiswa.classList.remove('hidden');
            } else {
                if (labelXlsxSiswa) labelXlsxSiswa.textContent = "Pilih File Siswa (.xlsx)";
                btnProcessSiswa.classList.add('hidden');
            }
        };

        btnProcessSiswa.onclick = () => {
            if (!selectedSiswaFile) return;

            const appUser = getAppUser();
            const targetClass = document.getElementById('import-class-select').value;

            if (appUser.role !== 'admin' && appUser.jabatan === 'Wali Kelas' && appUser.waliKelas && targetClass !== appUser.waliKelas) {
                alert(`AKSES DITOLAK: Anda menjabat sebagai Wali Kelas ${appUser.waliKelas}. Anda dilarang mengimpor data siswa untuk kelas ${targetClass}.`); return;
            }
            
            btnProcessSiswa.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i> Sedang Memproses...';
            btnProcessSiswa.disabled = true;

            const reader = new FileReader();

            const resetSiswaUploadUI = () => {
                importXlsxSiswa.value = null; selectedSiswaFile = null;
                if (labelXlsxSiswa) labelXlsxSiswa.textContent = "Pilih File Siswa (.xlsx)";
                btnProcessSiswa.classList.add('hidden');
                btnProcessSiswa.innerHTML = '<i class="ph ph-check-circle text-lg"></i> Simpan & Proses Siswa';
                btnProcessSiswa.disabled = false;
            };

            reader.onload = async (ev) => {
                let count = 0; let processedSiswa = [];

                try {
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    
                    for(let row of json) {
                        let n = String(row["Nama Siswa"] || "").trim();
                        let cls = String(row["Kelas"] || "").trim();
                        if(!n || !cls) continue;
                        if (appUser.role !== 'admin' && appUser.jabatan === 'Wali Kelas' && appUser.waliKelas && cls !== appUser.waliKelas) continue;
                        processedSiswa.push({ name: n, nisn: String(row["NISN"] || ""), className: cls });
                    }
                } catch(err) { alert("ERROR: Gagal membaca file Excel Siswa."); resetSiswaUploadUI(); return; }

                if (processedSiswa.length === 0) { alert("Tidak ada data siswa ditemukan."); resetSiswaUploadUI(); return; }

                try {
                    let currentBatch = writeBatch(db); let opCount = 0; const commitPromises = [];
                    for(const s of processedSiswa) {
                        for(const mapel of MASTER_SUBJECTS) {
                            currentBatch.set(doc(getGradesCollection()), { 
                                studentName: s.name, nisn: s.nisn, teacherName: 'admin', subject: mapel, className: s.className, 
                                tahun: getActiveTahun(), semester: getActiveSemester(), 
                                scores: { f1:null, f2:null, f3:null, t1:null, t2:null, t3:null, asaj:null }, 
                                results: { avgFormative:0, avgTask:0, final:0 }, createdAt: serverTimestamp() 
                            });
                            opCount++;
                            if (opCount >= 450) { commitPromises.push(currentBatch.commit()); currentBatch = writeBatch(db); opCount = 0; }
                        }
                        count++;
                    }
                    if (opCount > 0) commitPromises.push(currentBatch.commit());
                    await Promise.all(commitPromises);

                    await writeLog("IMPORT_SISWA", `${appUser.username} mengimpor ${count} siswa baru.`);
                    alert(`Berhasil! ${count} siswa baru telah ditambahkan ke sistem.`);
                    renderTableSiswa();
                } catch(err) { alert("ERROR DATABASE: Gagal menyimpan data siswa ke server."); }
                resetSiswaUploadUI();
            };
            reader.onerror = () => { alert("ERROR: Browser gagal membaca file."); resetSiswaUploadUI(); };
            reader.readAsArrayBuffer(selectedSiswaFile);
        };
    }

    const filterKelasSiswa = document.getElementById('crud-siswa-kelas-filter');
    if (filterKelasSiswa) { filterKelasSiswa.addEventListener('change', () => { renderTableSiswa(); }); }

    // ========================================================
    // 5. FITUR ADMIN: UNDUH GURU, HAPUS KELAS, RESET DB
    // ========================================================
    const btnTemplateGuru = document.getElementById('btn-template-guru');
    if (btnTemplateGuru) {
        btnTemplateGuru.onclick = async () => {
            // Tarik data segar dari database sebelum mendownload
            const usersSnap = await getDocs(collection(db, 'users'));
            let freshUsers = [];
            usersSnap.forEach(doc => { freshUsers.push(doc.data()); });

            const dataToExport = freshUsers.map(u => ({ "Username": u.username, "Role": u.role, "Jabatan": u.jabatan || "-", "Kelas Asuhan": u.waliKelas || "-", "Password": u.password }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DataGuru");
            XLSX.writeFile(wb, "Data_Akun_Guru.xlsx");
        };
    }

    const btnDeleteClass = document.getElementById('btn-delete-class');
    const deleteClassSelect = document.getElementById('delete-class-select');
    if (deleteClassSelect && btnDeleteClass) {
        deleteClassSelect.addEventListener('change', (e) => {
            if(e.target.value) { btnDeleteClass.disabled = false; btnDeleteClass.classList.replace('bg-gray-300', 'bg-red-600'); } 
            else { btnDeleteClass.disabled = true; btnDeleteClass.classList.replace('bg-red-600', 'bg-gray-300'); }
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
                deleteClassSelect.value = ''; btnDeleteClass.disabled = true; btnDeleteClass.textContent = "EKSEKUSI PENGHAPUSAN";
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
                if (snapshot.empty) { alert("Database kosong."); btnResetSiswa.innerHTML = '<i class="ph ph-users-three text-xl"></i> Kosongkan Data Siswa'; btnResetSiswa.disabled = false; return; }

                let batches = []; let currentBatch = writeBatch(db); let count = 0;
                snapshot.docs.forEach(d => { currentBatch.delete(d.ref); count++; if (count === 500) { batches.push(currentBatch.commit()); currentBatch = writeBatch(db); count = 0; } });
                if (count > 0) batches.push(currentBatch.commit());
                await Promise.all(batches); 

                await writeLog("RESET_DATA_SISWA", `Admin mengosongkan seluruh database siswa.`);
                alert(`Selesai! Sebanyak ${snapshot.docs.length} dokumen siswa berhasil dihapus.`);
                btnResetSiswa.innerHTML = '<i class="ph ph-users-three text-xl"></i> Kosongkan Data Siswa'; btnResetSiswa.disabled = false;
                renderTableSiswa(); 
            } catch (err) { alert("Terjadi kesalahan."); btnResetSiswa.innerHTML = '<i class="ph ph-users-three text-xl"></i> Kosongkan Data Siswa'; btnResetSiswa.disabled = false; }
        };
    }

    const btnResetDb = document.getElementById('btn-reset-db');
    if (btnResetDb) {
        btnResetDb.onclick = async () => {
            if(!confirm("Reset seluruh database sekolah? (Termasuk data guru dan pengaturan)")) return;
            await writeLog("RESET_DATABASE", "Request reset total database.");
            alert("Tindakan dicatat di Log Audit. Hapus data master & guru dilakukan manual di Firebase Console.");
        };
    }
}

// ========================================================
// GLOBAL FUNCTIONS (Diakses langsung dari HTML)
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
// FUNGSI GURU (CRUD LANGSUNG KE FIREBASE)
// ========================================================
window.editGuru = async (id, oldUsername, oldJabatan, oldWaliKelas) => {
    const decodedName = decodeURIComponent(oldUsername);
    const newJabatan = prompt(`Edit Jabatan untuk ${decodedName}:\nKetik persis salah satu:\n- Guru Mapel\n- Wali Kelas\n- Wakasek Kurikulum`, oldJabatan || 'Guru Mapel');
    if(!newJabatan) return;

    let newWaliKelas = oldWaliKelas || '';
    if (newJabatan === 'Wali Kelas') {
        newWaliKelas = prompt(`Masukkan KELAS ASUHAN untuk Wali Kelas ini (Contoh: X-1):`, newWaliKelas);
        if(!newWaliKelas) { alert("Proses dibatalkan. Wali Kelas wajib memiliki kelas asuhan."); return; }
    } else { newWaliKelas = ''; }

    try {
        await updateDoc(doc(db, 'users', id), { jabatan: newJabatan, waliKelas: newWaliKelas });
        renderTableGuru(); // Re-render dari Firebase
        alert(`Berhasil! Jabatan ${decodedName} diperbarui menjadi ${newJabatan} ${newWaliKelas ? '('+newWaliKelas+')' : ''}.`);
    } catch(e) { alert("Gagal mengupdate database Firebase."); }
};

window.deleteGuru = async (id, name) => {
    const decodedName = decodeURIComponent(name);
    if (!confirm(`Yakin ingin MENGHAPUS akun pengguna "${decodedName}" secara permanen?`)) return;
    try {
        await deleteDoc(doc(db, 'users', id));
        renderTableGuru(); // Re-render dari Firebase
        await writeLog("HAPUS_PENGGUNA", `Admin menghapus akun: ${decodedName}`);
        alert(`Akun ${decodedName} berhasil dihapus.`);
    } catch(e) { alert("Gagal menghapus akun."); }
};

window.openResetSandi = async (id, name) => {
    const decodedName = decodeURIComponent(name);
    const newPass = prompt(`Masukkan password baru untuk "${decodedName}":`, "123456");
    if (!newPass) return;
    try {
        await updateDoc(doc(db, 'users', id), { password: newPass });
        renderTableGuru(); // Re-render dari Firebase
        await writeLog("RESET_SANDI", `Admin mereset sandi untuk akun: ${decodedName}`);
        alert(`Password ${decodedName} berhasil direset!`);
    } catch(e) { alert("Gagal mereset password."); }
};

// ========================================================
// FUNGSI SISWA
// ========================================================
window.editSiswa = async (encN, encI, encC) => {
    const oldName = decodeURIComponent(encN); const oldNisn = decodeURIComponent(encI); const studentClass = decodeURIComponent(encC);
    const thn = getActiveTahun(); const smt = getActiveSemester();

    const newName = prompt("Edit Nama Lengkap Siswa:", oldName);
    if(!newName || newName.trim() === '') return;
    const newNisn = prompt("Edit NISN:", oldNisn) || "";

    try {
        const docsToUpdate = gradesData.filter(g => g.className === studentClass && g.tahun === thn && g.semester === smt && g.studentName === oldName && (g.nisn || '') === oldNisn);
        if(docsToUpdate.length > 0) {
            const batch = writeBatch(db);
            docsToUpdate.forEach(d => { batch.update(doc(getGradesCollection(), d.id), { studentName: newName, nisn: newNisn, updatedAt: serverTimestamp() }); });
            await batch.commit();
            await writeLog("EDIT_SISWA", `${getAppUser().username} mengubah nama siswa ${oldName} menjadi ${newName}.`);
            alert(`Siswa ${oldName} berhasil diupdate!`);
            renderTableSiswa();
        }
    } catch(err) { alert("Gagal update."); }
};

window.deleteSiswa = async (encN, encI, encC) => {
    const name = decodeURIComponent(encN); const nisn = decodeURIComponent(encI); const studentClass = decodeURIComponent(encC);
    const thn = getActiveTahun(); const smt = getActiveSemester();

    if(!confirm(`Hapus seluruh data (nama & nilai) "${name}" di kelas ${studentClass}?`)) return;

    try {
        const docsToDelete = gradesData.filter(g => g.className === studentClass && g.tahun === thn && g.semester === smt && g.studentName === name && (g.nisn || '') === nisn);
        if(docsToDelete.length > 0) {
            const backupJSON = JSON.stringify(docsToDelete.map(d => ({ mapel: d.subject, scores: d.scores })));
            const batch = writeBatch(db);
            docsToDelete.forEach(d => batch.delete(doc(getGradesCollection(), d.id)));
            await batch.commit();
            await writeLog("HAPUS_SISWA_UTUH", `${getAppUser().username} menghapus siswa ${name} (${studentClass}). Backup: ${backupJSON}`);
            alert(`Data ${name} dihapus.`);
            renderTableSiswa();
        }
    } catch(err) { alert("Gagal hapus."); }
};
