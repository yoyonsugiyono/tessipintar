// File: js/ui/admin.js

import { doc, deleteDoc, updateDoc, addDoc, getDocs, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, getUsersCollection, getGradesCollection, getSettingsCollection } from '../config/firebase.js';
import { USERS_DB, loadUsersFromDB, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { MASTER_CLASSES, MASTER_SUBJECTS, saveMasterData } from '../services/db-master.js';
import { renderTableGuru, renderTableSiswa, renderMasterDataUI, populateDropdowns, gradesData } from './tables.js';

export function setupAdminEvents() {
    // ==========================================
    // 1. LOGIKA MODAL (POP-UP)
    // ==========================================
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.onclick = (e) => {
            const modal = e.target.closest('.fixed.inset-0');
            const content = modal.querySelector('div.bg-white');
            if (content) {
                content.classList.replace('scale-100', 'scale-95');
                content.classList.replace('opacity-100', 'opacity-0');
            }
            setTimeout(() => modal.classList.add('hidden'), 200);
        };
    });

    window.openModal = (modalEl) => {
        modalEl.classList.remove('hidden');
        modalEl.classList.add('flex');
        const content = modalEl.querySelector('div.bg-white');
        if (content) {
            setTimeout(() => {
                content.classList.replace('scale-95', 'scale-100');
                content.classList.replace('opacity-0', 'opacity-100');
            }, 10);
        }
    };

    // ==========================================
    // 2. MASTER DATA (KELAS & MAPEL)
    // ==========================================
    const btnAddClass = document.getElementById('btn-add-master-class');
    if (btnAddClass) {
        btnAddClass.onclick = async () => {
            const val = document.getElementById('in-master-class').value.trim();
            if(val && !MASTER_CLASSES.includes(val)) {
                MASTER_CLASSES.push(val);
                document.getElementById('in-master-class').value = '';
                await saveMasterData(MASTER_SUBJECTS, MASTER_CLASSES);
                populateDropdowns();
                renderMasterDataUI();
            }
        };
    }

    const btnAddSubj = document.getElementById('btn-add-master-subject');
    if (btnAddSubj) {
        btnAddSubj.onclick = async () => {
            const val = document.getElementById('in-master-subject').value.trim();
            if(val && !MASTER_SUBJECTS.includes(val)) {
                MASTER_SUBJECTS.push(val);
                document.getElementById('in-master-subject').value = '';
                await saveMasterData(MASTER_SUBJECTS, MASTER_CLASSES);
                populateDropdowns();
                renderMasterDataUI();
            }
        };
    }

    // ==========================================
    // 3. HAPUS DATA KELAS PERMANEN
    // ==========================================
    const deleteClassSel = document.getElementById('delete-class-select');
    const btnDeleteClass = document.getElementById('btn-delete-class');

    if (deleteClassSel && btnDeleteClass) {
        deleteClassSel.onchange = (e) => {
            const val = e.target.value;
            btnDeleteClass.disabled = !val;
            btnDeleteClass.classList.toggle('bg-red-600', !!val);
            btnDeleteClass.classList.toggle('bg-gray-300', !val);
            btnDeleteClass.classList.toggle('cursor-not-allowed', !val);
        };

        btnDeleteClass.onclick = async () => {
            const cls = deleteClassSel.value;
            if(!cls) { alert("Pilih Kelas!"); return; }
            
            const thn = getActiveTahun();
            const smt = getActiveSemester();

            if(!window.confirm(`Yakin hapus SEMUA data ${cls} pada periode ${thn} - Semester ${smt}?`)) return;
            if(!window.confirm(`Konfirmasi terakhir: Hapus permanen ${cls}? Tindakan ini tidak dapat dibatalkan.`)) return;
            
            const docsToDelete = gradesData.filter(g => g.className === cls && g.tahun === thn && g.semester === smt);
            if(!docsToDelete.length) { alert("Tidak ada data siswa/nilai di kelas ini pada periode aktif."); return; }
            
            btnDeleteClass.disabled = true; btnDeleteClass.textContent = "Sedang Menghapus...";
            
            try {
                await Promise.all(docsToDelete.map(d => deleteDoc(doc(getGradesCollection(), d.id))));
                alert(`Berhasil! ${docsToDelete.length} data dihapus.`);
                deleteClassSel.value = "";
                btnDeleteClass.disabled = true;
                btnDeleteClass.textContent = "Hapus Permanen Data Kelas";
                btnDeleteClass.classList.add('bg-gray-300', 'cursor-not-allowed');
                btnDeleteClass.classList.remove('bg-red-600');
            } catch(e) {
                console.error("[DEBUG] GAGAL HAPUS KELAS", e);
                alert("Gagal menghapus data kelas.");
                btnDeleteClass.disabled = false; btnDeleteClass.textContent = "Hapus Permanen Data Kelas";
            }
        };
    }

    // ==========================================
    // 4. CRUD GURU (TAMBAH MANUAL)
    // ==========================================
    let isEditGuruMode = false;
    const crudGuruForm = document.getElementById('crud-guru-form');
    
    if(document.getElementById('btn-add-guru')) {
        document.getElementById('btn-add-guru').onclick = () => {
            crudGuruForm.reset();
            document.getElementById('crud-guru-id').value = '';
            document.getElementById('crud-guru-title').textContent = "Tambah Pengguna Baru";
            isEditGuruMode = false;
            window.openModal(document.getElementById('crud-guru-modal'));
        };
    }

    if(crudGuruForm) {
        crudGuruForm.onsubmit = async (e) => {
            e.preventDefault();
            const payload = { 
                username: document.getElementById('crud-guru-name').value, 
                role: document.getElementById('crud-guru-role').value, 
                password: document.getElementById('crud-guru-pass').value 
            };
            
            try {
                if(isEditGuruMode) {
                    await updateDoc(doc(getUsersCollection(), document.getElementById('crud-guru-id').value), payload);
                } else {
                    await addDoc(getUsersCollection(), payload);
                }
                document.getElementById('crud-guru-modal').querySelector('.btn-close-modal').click();
                await loadUsersFromDB();
                renderTableGuru();
            } catch(err) { alert("Gagal menyimpan data guru!"); }
        };
    }

    // ==========================================
    // 5. EXPORT / IMPORT EXCEL (SISWA & GURU)
    // ==========================================
    
    // A. Download Template Siswa
    const btnTemplateSiswa = document.getElementById('btn-template-siswa');
    if (btnTemplateSiswa) {
        btnTemplateSiswa.onclick = () => {
            const ws = XLSX.utils.json_to_sheet([{ "Nama Siswa": "Budi Santoso", "NISN": "0011223344" }]);
            ws['!cols'] = [{wch: 30}, {wch: 20}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "FormatSiswa");
            XLSX.writeFile(wb, "Format_Import_Siswa.xlsx");
        };
    }

    // B. Import Excel Siswa Massal
    const importXlsxSiswa = document.getElementById('import-xlsx-siswa');
    if (importXlsxSiswa) {
        importXlsxSiswa.onchange = (e) => {
            const cls = document.getElementById('import-class-select').value; 
            if(!cls) { alert("Pilih kelas tujuan di menu atas terlebih dahulu!"); e.target.value=null; return; }
            
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    console.log(`[DEBUG] Memproses Import Excel Siswa Kelas ${cls}...`);
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                    let count = 0;
                    for(let row of json) {
                        let n = String(row["Nama Siswa"] || row["Nama"] || "").trim();
                        let nis = String(row["NISN"] || "").trim();
                        if(!n) continue; 

                        for(const s of MASTER_SUBJECTS) {
                            const p = { 
                                studentName: n, nisn: nis, teacherName: 'admin', subject: s, className: cls, 
                                tahun: getActiveTahun(), semester: getActiveSemester(), 
                                scores: { f1:null, f2:null, f3:null, t1:null, t2:null, t3:null, asaj:null }, 
                                results: { avgFormative:0, avgTask:0, final:0 }, 
                                createdAt: serverTimestamp() 
                            };
                            await addDoc(getGradesCollection(), p);
                        }
                        count++;
                    }
                    alert(`Impor ${count} siswa berhasil!`);
                } catch(err) { alert("Format Excel tidak valid atau gagal dibaca."); console.error(err); }
                e.target.value = null;
            };
            reader.readAsArrayBuffer(file);
        };
    }

    // C. Download Template Guru
    const btnTemplateGuru = document.getElementById('btn-template-guru');
    if (btnTemplateGuru) {
        btnTemplateGuru.onclick = () => {
            const ws = XLSX.utils.json_to_sheet([{ "Username": "Guru Budi, S.Pd", "Role": "guru", "Password": "Guru123" }]);
            ws['!cols'] = [{wch: 30}, {wch: 15}, {wch: 20}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "FormatGuru");
            XLSX.writeFile(wb, "Format_Import_Guru.xlsx");
        };
    }

    // D. Import Excel Guru Massal
    const importXlsxGuruAdmin = document.getElementById('import-xlsx-guru-admin');
    if (importXlsxGuruAdmin) {
        importXlsxGuruAdmin.onchange = (e) => {
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
                        let username = String(row["Username"] || row["Nama Lengkap"] || "").trim();
                        let role = String(row["Role"] || row["Peran"] || "").trim().toLowerCase();
                        let password = String(row["Password"] || row["Sandi"] || "").trim();
                        if(!username || !role || !password) continue;

                        await addDoc(getUsersCollection(), { username, role, password });
                        count++;
                    }
                    alert(`Impor ${count} akun guru berhasil!`);
                    await loadUsersFromDB(); 
                    renderTableGuru();
                } catch (err) { alert("Format Excel tidak valid."); console.error(err); }
                e.target.value = null;
            };
            reader.readAsArrayBuffer(file);
        };
    }

    // ==========================================
    // 6. BACKUP, RESTORE & RESET DATABASE (SUPER ADMIN)
    // ==========================================
    const btnBackupDB = document.getElementById('btn-backup-db');
    if (btnBackupDB) {
        btnBackupDB.onclick = async () => {
            try {
                console.log("[DEBUG] Memulai proses backup database...");
                const gradesSnap = await getDocs(getGradesCollection());
                const usersSnap = await getDocs(getUsersCollection());
                const settingsSnap = await getDocs(getSettingsCollection());

                const data = {
                    timestamp: new Date().toISOString(),
                    grades: gradesSnap.docs.map(d => ({id: d.id, ...d.data()})),
                    users: usersSnap.docs.map(d => ({id: d.id, ...d.data()})),
                    settings: settingsSnap.docs.map(d => ({id: d.id, ...d.data()}))
                };

                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `Backup_SiPINTAR_${new Date().toISOString().slice(0,10)}.json`;
                a.click();
                console.log("[DEBUG] Backup berhasil diunduh.");
            } catch (err) { alert("Gagal memproses backup database!"); console.error(err); }
        };
    }

    const importJsonRestore = document.getElementById('import-json-restore');
    if (importJsonRestore) {
        importJsonRestore.onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;

            if(!window.confirm("PERINGATAN: Memulihkan database akan MENIMPA dan MENAMBAH data yang ada. Lanjutkan?")) {
                e.target.value = null; return;
            }

            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    console.log("[DEBUG] Memulai proses restore database...");
                    const data = JSON.parse(ev.target.result);

                    const commitBatches = async (items, collectionRef) => {
                        let batches = [];
                        let currentBatch = writeBatch(db);
                        let count = 0;
                        for(const item of items) {
                            const id = item.id;
                            const docData = {...item}; delete docData.id;
                            currentBatch.set(doc(collectionRef, id), docData);
                            count++;
                            if(count === 500) { batches.push(currentBatch.commit()); currentBatch = writeBatch(db); count = 0; }
                        }
                        if(count > 0) batches.push(currentBatch.commit());
                        await Promise.all(batches);
                    };

                    if (data.users) await commitBatches(data.users, getUsersCollection());
                    if (data.grades) await commitBatches(data.grades, getGradesCollection());
                    if (data.settings) await commitBatches(data.settings, getSettingsCollection());

                    alert("Restore Database Berhasil!");
                    window.location.reload(); // Reload untuk memuat ulang semuanya
                } catch (err) { alert("File backup tidak valid atau gagal dipulihkan!"); console.error(err); }
                e.target.value = null;
            };
            reader.readAsText(file);
        };
    }

    const btnResetDB = document.getElementById('btn-reset-db');
    if (btnResetDB) {
        btnResetDB.onclick = async () => {
            if (!window.confirm("PERINGATAN 1: MENGHAPUS SELURUH DATABASE (Data Nilai & Akun Guru) TIDAK BISA DIBATALKAN!")) return;
            if (!window.confirm("PERINGATAN 2: KONFIRMASI TERAKHIR! Pastikan Anda sudah Backup. Yakin?")) return;

            try {
                btnResetDB.disabled = true; btnResetDB.textContent = "Sedang Mereset...";
                console.log("[DEBUG] Memulai reset database massal...");

                const gradesSnap = await getDocs(getGradesCollection());
                const usersSnap = await getDocs(getUsersCollection());

                const refsToDelete = [];
                gradesSnap.docs.forEach(d => refsToDelete.push(d.ref));
                usersSnap.docs.forEach(d => { if (d.data().role !== 'admin') refsToDelete.push(d.ref); });

                let batches = [];
                let currentBatch = writeBatch(db);
                let count = 0;

                for (const ref of refsToDelete) {
                    currentBatch.delete(ref);
                    count++;
                    if (count === 500) { batches.push(currentBatch.commit()); currentBatch = writeBatch(db); count = 0; }
                }
                if (count > 0) batches.push(currentBatch.commit());

                await Promise.all(batches);
                alert("Database berhasil di-reset total!");
                window.location.reload(); // Reload agar sistem bersih
            } catch (err) { 
                alert("Gagal mereset database!"); console.error(err); 
                btnResetDB.disabled = false; btnResetDB.innerHTML = '<i class="ph ph-trash"></i> Reset Seluruh Database Sekolah';
            }
        };
    }

    // ==========================================
    // DEKLARASI FUNGSI GLOBAL (Agar bisa dipanggil dari HTML OnClick)
    // ==========================================
    window.deleteMasterClass = async (idx) => {
        if(!confirm(`Hapus kelas "${MASTER_CLASSES[idx]}"?`)) return;
        MASTER_CLASSES.splice(idx, 1);
        await saveMasterData(MASTER_SUBJECTS, MASTER_CLASSES);
        populateDropdowns();
        renderMasterDataUI();
    };

    window.deleteMasterSubject = async (idx) => {
        if(!confirm(`Hapus mapel "${MASTER_SUBJECTS[idx]}"?`)) return;
        MASTER_SUBJECTS.splice(idx, 1);
        await saveMasterData(MASTER_SUBJECTS, MASTER_CLASSES);
        populateDropdowns();
        renderMasterDataUI();
    };

    window.editGuru = (id) => {
        const u = USERS_DB.find(x => x.id === id);
        if(!u) return;
        document.getElementById('crud-guru-id').value = u.id;
        document.getElementById('crud-guru-name').value = u.username;
        document.getElementById('crud-guru-role').value = u.role;
        document.getElementById('crud-guru-pass').value = u.password;
        document.getElementById('crud-guru-title').textContent = "Edit Data Pengguna";
        isEditGuruMode = true;
        window.openModal(document.getElementById('crud-guru-modal'));
    };

    window.deleteGuru = async (id, encName) => {
        const name = decodeURIComponent(encName);
        if(!confirm(`Hapus pengguna '${name}' secara permanen?`)) return;
        try {
            await deleteDoc(doc(getUsersCollection(), id));
            await loadUsersFromDB();
            renderTableGuru();
        } catch(err) { alert("Gagal hapus!"); }
    };
}
