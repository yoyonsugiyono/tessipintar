// File: js/ui/admin.js

import { doc, deleteDoc, updateDoc, addDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, getUsersCollection, getGradesCollection } from '../config/firebase.js';
import { USERS_DB, loadUsersFromDB, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { MASTER_CLASSES, MASTER_SUBJECTS, saveMasterData } from '../services/db-master.js';
import { renderTableGuru, renderTableSiswa, renderMasterDataUI, populateDropdowns, gradesData } from './tables.js';

export function setupAdminEvents() {
    // 1. Logika Buka/Tutup Modal (Pop-up)
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

    // 2. Event Master Data (Tambah Kelas & Mapel)
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
    // 3. FITUR HAPUS DATA KELAS (YANG SEBELUMNYA HILANG)
    // ==========================================
    const deleteClassSel = document.getElementById('delete-class-select');
    const btnDeleteClass = document.getElementById('btn-delete-class');

    if (deleteClassSel && btnDeleteClass) {
        // Aktifkan tombol Hapus hanya jika kelas sudah dipilih
        deleteClassSel.onchange = (e) => {
            const val = e.target.value;
            btnDeleteClass.disabled = !val;
            btnDeleteClass.classList.toggle('bg-red-600', !!val);
            btnDeleteClass.classList.toggle('bg-gray-300', !val);
            btnDeleteClass.classList.toggle('cursor-not-allowed', !val);
        };

        // Logika saat tombol Hapus diklik
        btnDeleteClass.onclick = async () => {
            const cls = deleteClassSel.value;
            if(!cls) { alert("Pilih Kelas!"); return; }
            
            const thn = getActiveTahun();
            const smt = getActiveSemester();

            // Konfirmasi keamanan ganda
            if(!window.confirm(`Yakin hapus SEMUA data ${cls} pada periode ${thn} - Semester ${smt}?`)) return;
            if(!window.confirm(`Konfirmasi terakhir: Hapus permanen ${cls}? Tindakan ini tidak dapat dibatalkan.`)) return;
            
            // Cari semua dokumen nilai yang milik kelas, tahun, dan semester tersebut
            const docsToDelete = gradesData.filter(g => g.className === cls && g.tahun === thn && g.semester === smt);
            
            if(!docsToDelete.length) { 
                alert("Tidak ada data siswa/nilai di kelas ini pada periode aktif."); 
                return; 
            }
            
            btnDeleteClass.disabled = true; 
            btnDeleteClass.textContent = "Sedang Menghapus...";
            
            try {
                // Hapus masal secara paralel untuk kecepatan
                await Promise.all(docsToDelete.map(d => deleteDoc(doc(getGradesCollection(), d.id))));
                alert(`Berhasil! ${docsToDelete.length} data siswa & nilai kelas ${cls} telah dihapus.`);
                
                // Reset tampilan
                deleteClassSel.value = "";
                btnDeleteClass.disabled = true;
                btnDeleteClass.textContent = "Hapus Permanen Data Kelas";
                btnDeleteClass.classList.add('bg-gray-300', 'cursor-not-allowed');
                btnDeleteClass.classList.remove('bg-red-600');
            } catch(e) {
                console.error("[DEBUG] GAGAL HAPUS KELAS", e);
                alert("Gagal menghapus data kelas. Cek koneksi Anda.");
                btnDeleteClass.disabled = false; 
                btnDeleteClass.textContent = "Hapus Permanen Data Kelas";
            }
        };
    }

    // 4. Event CRUD Guru
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

    // --- DEKLARASI FUNGSI GLOBAL AGAR BISA DIPANGGIL DARI HTML ---
    
    window.deleteMasterClass = async (idx) => {
        if(!confirm(`Hapus kelas "${MASTER_CLASSES[idx]}"?`)) return;
        MASTER_CLASSES.splice(idx, 1);
        await saveMasterData(MASTER_SUBJECTS, MASTER_CLASSES);
        populateDropdowns();
        renderMasterDataUI();
    };

    window.deleteMasterSubject = async (idx) => {
        if(!confirm(`Hapus mata pelajaran "${MASTER_SUBJECTS[idx]}"?`)) return;
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
