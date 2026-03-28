// File: js/ui/events.js

import { getAppUser, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { getCalc, weights, saveNewGrade, san } from '../services/db-grades.js';
import { setFilters, renderTable, gradesData, setEditGradeId, editGradeId } from './tables.js';
import { doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getGradesCollection } from '../config/firebase.js';

let currentDeleteId = null;

export function setupUIEvents() {
    // 1. Setup Filter Dropdowns
    const fGuru = document.getElementById('filter-guru');
    const fMapel = document.getElementById('filter-mapel');
    const fKelas = document.getElementById('filter-kelas');
    
    const updateFilters = () => {
        setFilters(fKelas?.value || '', fMapel?.value || '', fGuru?.value || 'all');
        renderTable();
    };

    if(fGuru) fGuru.onchange = updateFilters;
    if(fMapel) fMapel.onchange = updateFilters;
    if(fKelas) fKelas.onchange = updateFilters;

    // 2. Setup Bobot Nilai (Guru)
    document.getElementById('w-f')?.addEventListener('input', (e) => { weights.f = e.target.value; renderTable(); });
    document.getElementById('w-t')?.addEventListener('input', (e) => { weights.t = e.target.value; renderTable(); });
    document.getElementById('w-a')?.addEventListener('input', (e) => { weights.a = e.target.value; renderTable(); });

    // 3. Setup Form Tambah Nilai Manual (Guru)
    const gradeForm = document.getElementById('grade-form');
    if(gradeForm) {
        gradeForm.onsubmit = async (e) => {
            e.preventDefault();
            const appUser = getAppUser();
            if (!appUser) return;
            
            let tot = parseFloat(weights.f) + parseFloat(weights.t) + parseFloat(weights.a);
            if(Math.abs(tot - 100) > 0.1) { alert(`Total bobot harus 100% (${tot}%)`); return; }

            const s = { 
                f1:san(document.getElementById('in-f1').value), f2:san(document.getElementById('in-f2').value), f3:san(document.getElementById('in-f3').value), 
                t1:san(document.getElementById('in-t1').value), t2:san(document.getElementById('in-t2').value), t3:san(document.getElementById('in-t3').value), 
                asaj:san(document.getElementById('in-asaj').value) 
            };
            const c = getCalc(s);
            
            const payload = { 
                studentName: document.getElementById('in-name').value, 
                nisn: document.getElementById('in-nisn').value, 
                teacherName: appUser.username, 
                subject: fMapel.value, 
                className: fKelas.value, 
                tahun: getActiveTahun(), 
                semester: getActiveSemester(),
                scores: s, 
                results: {avgFormative: parseFloat(c.avgFormative), avgTask:parseFloat(c.avgTask), final:parseFloat(c.final)}, 
                weightsSnapshot: weights 
            };

            try {
                await saveNewGrade(payload, editGradeId);
                // Reset form setelah simpan
                gradeForm.reset();
                document.getElementById('in-na').textContent = '0.0';
                document.getElementById('in-na').className = "px-4 py-3 text-center font-bold align-middle text-blue-700 bg-blue-100/50";
                setEditGradeId(null);
                document.getElementById('badge-edit-mode')?.classList.add('hidden');
                document.getElementById('btn-cancel-edit')?.classList.add('hidden');
                renderTable();
            } catch (err) { alert("Gagal menyimpan data!"); }
        };
    }

    // 4. Tombol Batal Edit
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    if(btnCancelEdit) {
        btnCancelEdit.onclick = () => {
            setEditGradeId(null);
            gradeForm?.reset();
            document.getElementById('in-na').textContent = '0.0';
            document.getElementById('badge-edit-mode')?.classList.add('hidden');
            btnCancelEdit.classList.add('hidden');
            renderTable();
        };
    }

    // 5. Delegasi Event pada Tabel (Ketik Langsung & Auto-Save)
    const gradesTbody = document.getElementById('grades-tbody');
    if(gradesTbody) {
        // Efek Live Hitung saat mengetik
        gradesTbody.addEventListener('input', (e) => {
            if(e.target.tagName === 'INPUT') {
                const tr = e.target.closest('tr');
                if (tr.id === 'row-new-grade') return; // Di-handle terpisah
                
                let val = parseFloat(e.target.value);
                if (val > 100) e.target.value = 100;
                if (val < 0) e.target.value = 0;

                const inps = tr.querySelectorAll('input');
                if (inps.length >= 7) {
                    const s = { f1:inps[0].value, f2:inps[1].value, f3:inps[2].value, t1:inps[3].value, t2:inps[4].value, t3:inps[5].value, asaj:inps[6].value };
                    const cellNa = tr.querySelector('.cell-na');
                    if (cellNa) {
                        const finVal = getCalc(s).final;
                        const isRemed = parseFloat(finVal) < 75;
                        cellNa.innerHTML = (isRemed ? '<i class="ph ph-warning-circle text-red-500 mr-1"></i>' : '') + finVal;
                        cellNa.className = `px-4 py-3 text-center font-bold cell-na ${isRemed ? 'text-red-600 bg-red-50' : 'text-blue-700 bg-blue-50/20'}`;
                    }
                }
            }
        });

        // Efek Auto-Save saat berpindah kotak (Blur)
        gradesTbody.addEventListener('focusout', async (e) => {
            if(e.target.tagName === 'INPUT') {
                const tr = e.target.closest('tr');
                if (tr.id === 'row-new-grade') return;
                
                const id = tr.dataset.id;
                const item = gradesData.find(g=>g.id===id);
                if(!item) return;

                const field = e.target.dataset.f;
                const val = e.target.value;
                if(item.scores[field] == val) return; // Tidak ada perubahan, batalkan save

                console.log(`[DEBUG] Auto-save: Menyimpan perubahan nilai untuk ${item.studentName}...`);
                const ns = { ...item.scores, [field]: san(val) };
                const c = getCalc(ns);
                
                try {
                    await updateDoc(doc(getGradesCollection(), id), {
                        scores: ns,
                        results: {avgFormative: parseFloat(c.avgFormative), avgTask:parseFloat(c.avgTask), final:parseFloat(c.final)},
                        updatedAt: serverTimestamp()
                    });
                } catch(err) { console.error("Gagal Auto-Save", err); }
            }
        });
    }
}
