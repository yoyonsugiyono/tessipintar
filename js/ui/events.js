// File: js/ui/events.js

import { getAppUser, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { getCalc, weights, saveNewGrade, san, ds } from '../services/db-grades.js';
import { 
    setFilters, renderTable, gradesData, setEditGradeId, editGradeId, 
    getDisplayData, selClass, selSubject, setSearchQuery 
} from './tables.js';
import { doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getGradesCollection } from '../config/firebase.js';

export function setupUIEvents() {
    console.log("[DEBUG] Menginisialisasi Event Listeners UI...");

    // ==========================================
    // 1. FITUR PENCARIAN NAMA SISWA
    // ==========================================
    const searchInput = document.getElementById('search-siswa');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            setSearchQuery(e.target.value);
            renderTable(); // Re-render tabel berdasarkan pencarian
        });
    }

    // ==========================================
    // 2. SETUP FILTER DROPDOWNS (KELAS, MAPEL, GURU)
    // ==========================================
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

    // ==========================================
    // 3. SETUP BOBOT NILAI (GURU ONLY)
    // ==========================================
    document.getElementById('w-f')?.addEventListener('input', (e) => { weights.f = e.target.value; renderTable(); });
    document.getElementById('w-t')?.addEventListener('input', (e) => { weights.t = e.target.value; renderTable(); });
    document.getElementById('w-a')?.addEventListener('input', (e) => { weights.a = e.target.value; renderTable(); });

    // ==========================================
    // 4. FORM TAMBAH / EDIT NILAI MANUAL
    // ==========================================
    const gradeForm = document.getElementById('grade-form');
    if(gradeForm) {
        gradeForm.onsubmit = async (e) => {
            e.preventDefault();
            const appUser = getAppUser();
            if (!appUser) return;
            
            // Validasi Bobot
            let tot = parseFloat(weights.f) + parseFloat(weights.t) + parseFloat(weights.a);
            if(Math.abs(tot - 100) > 0.1) { 
                alert(`Total bobot harus 100%. Saat ini: ${tot}%`); 
                return; 
            }

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
                setEditGradeId(null);
                document.getElementById('badge-edit-mode')?.classList.add('hidden');
                document.getElementById('btn-cancel-edit')?.classList.add('hidden');
                renderTable();
            } catch (err) { alert("Gagal menyimpan data!"); }
        };
    }

    // Tombol Batal Edit
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

    // ==========================================
    // 5. EXPORT & IMPORT NILAI (EXCEL)
    // ==========================================
    
    // DOWNLOAD FORMAT (Isi Otomatis Data Siswa Terpilih)
    const btnTemplateNilai = document.getElementById('btn-template-nilai');
    if (btnTemplateNilai) {
        btnTemplateNilai.onclick = () => {
            const d = getDisplayData();
            if (!d.length) { alert("Pilih Kelas dan Mapel yang memiliki data siswa terlebih dahulu."); return; }

            const excelData = d.map((it, i) => ({
                "ID_SISTEM (JANGAN DIUBAH)": it.id,
                "No": i + 1,
                "Nama Siswa": it.studentName,
                "NISN": it.nisn || "-",
                "F1": ds(it.scores.f1), "F2": ds(it.scores.f2), "F3": ds(it.scores.f3),
                "T1": ds(it.scores.t1), "T2": ds(it.scores.t2), "T3": ds(it.scores.t3),
                "ASAJ": ds(it.scores.asaj)
            }));

            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "InputNilai");
            XLSX.writeFile(wb, `FormatNilai_${selClass}_${selSubject}.xlsx`);
        };
    }

    // IMPORT NILAI MASAL
    const importXlsxNilai = document.getElementById('import-xlsx-nilai');
    if (importXlsxNilai) {
        importXlsxNilai.onchange = (e) => {
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
                        const id = row["ID_SISTEM (JANGAN DIUBAH)"];
                        if(!id) continue;
                        
                        const ns = { 
                            f1:san(row["F1"]), f2:san(row["F2"]), f3:san(row["F3"]), 
                            t1:san(row["T1"]), t2:san(row["T2"]), t3:san(row["T3"]), asaj:san(row["ASAJ"]) 
                        };
                        const c = getCalc(ns);
                        
                        await updateDoc(doc(getGradesCollection(), id), {
                            scores: ns,
                            results: { avgFormative: parseFloat(c.avgFormative), avgTask: parseFloat(c.avgTask), final: parseFloat(c.final) },
                            updatedAt: serverTimestamp()
                        });
                        count++;
                    }
                    alert(`Berhasil memperbarui ${count} data nilai via Excel.`);
                    renderTable();
                } catch(err) { alert("Format file Excel tidak sesuai."); }
                e.target.value = null;
            };
            reader.readAsArrayBuffer(file);
        };
    }

    // ==========================================
    // 6. DELEGASI EVENT TABEL (AUTO-SAVE & EDIT/DEL)
    // ==========================================
    const gradesTbody = document.getElementById('grades-tbody');
    if(gradesTbody) {
        
        // A. LIVE CALCULATION (SAAT MENGETIK)
        gradesTbody.addEventListener('input', (e) => {
            if(e.target.tagName === 'INPUT') {
                const tr = e.target.closest('tr');
                if (tr.id === 'row-new-grade') {
                    // Kalkulasi untuk baris input baru
                    const inps = tr.querySelectorAll('.in-score');
                    const s = { f1:inps[0].value, f2:inps[1].value, f3:inps[2].value, t1:inps[3].value, t2:inps[4].value, t3:inps[5].value, asaj:inps[6].value };
                    document.getElementById('in-na').textContent = getCalc(s).final;
                    return;
                }
                
                // Kalkulasi untuk baris yang sudah ada (Auto-Update Cell NA)
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

        // B. AUTO-SAVE KE DATABASE (SAAT KOTAK INPUT DITINGGALKAN / BLUR)
        gradesTbody.addEventListener('focusout', async (e) => {
            if(e.target.tagName === 'INPUT') {
                const tr = e.target.closest('tr');
                if (tr.id === 'row-new-grade') return;
                
                const id = tr.dataset.id;
                const item = gradesData.find(g=>g.id===id);
                if(!item) return;

                const field = e.target.dataset.f;
                const val = e.target.value;
                
                // Cek jika tidak ada perubahan, jangan simpan (hemat kuota database)
                if(item.scores[field] == val) return;

                console.log(`[DEBUG] Auto-saving nilai ${field} untuk ${item.studentName}...`);
                const ns = { ...item.scores, [field]: san(val) };
                const c = getCalc(ns);
                
                try {
                    await updateDoc(doc(getGradesCollection(), id), {
                        scores: ns,
                        results: {avgFormative: parseFloat(c.avgFormative), avgTask:parseFloat(c.avgTask), final:parseFloat(c.final)},
                        updatedAt: serverTimestamp()
                    });
                } catch(err) { console.error("Gagal Auto-Save ke Firestore", err); }
            }
        });

        // C. ACTION BUTTONS (EDIT & DELETE)
        gradesTbody.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit');
            const btnDel = e.target.closest('.btn-del');
            
            if (btnEdit) {
                const tr = btnEdit.closest('tr');
                const id = tr.dataset.id;
                const item = gradesData.find(g => g.id === id);
                if (item) {
                    setEditGradeId(id);
                    document.getElementById('in-name').value = item.studentName;
                    document.getElementById('in-nisn').value = item.nisn || '';
                    document.getElementById('in-f1').value = ds(item.scores.f1);
                    document.getElementById('in-f2').value = ds(item.scores.f2);
                    document.getElementById('in-f3').value = ds(item.scores.f3);
                    document.getElementById('in-t1').value = ds(item.scores.t1);
                    document.getElementById('in-t2').value = ds(item.scores.t2);
                    document.getElementById('in-t3').value = ds(item.scores.t3);
                    document.getElementById('in-asaj').value = ds(item.scores.asaj);
                    document.getElementById('in-na').textContent = getCalc(item.scores).final;
                    
                    document.getElementById('badge-edit-mode').classList.remove('hidden');
                    document.getElementById('btn-cancel-edit').classList.remove('hidden');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }

            if (btnDel) {
                const tr = btnDel.closest('tr');
                const id = tr.dataset.id;
                const item = gradesData.find(g => g.id === id);
                if (confirm(`Hapus data nilai siswa "${item.studentName}"?`)) {
                    deleteDoc(doc(getGradesCollection(), id))
                        .then(() => { alert("Data terhapus."); renderTable(); })
                        .catch(() => alert("Gagal menghapus."));
                }
            }
        });
    }
}
