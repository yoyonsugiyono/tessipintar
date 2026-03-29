// File: js/ui/events.js

import { getAppUser, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { getCalc, weights, saveNewGrade, san, ds } from '../services/db-grades.js';
import { 
    setFilters, renderTable, gradesData, setEditGradeId, editGradeId, 
    getDisplayData, selClass, selSubject, setSearchQuery 
} from './tables.js';
import { doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getGradesCollection } from '../config/firebase.js';
import { writeLog } from '../services/audit.js';

export function setupUIEvents() {
    console.log("[DEBUG] Menginisialisasi Event Listeners UI...");

    // 1. FILTER & SEARCH
    const searchInput = document.getElementById('search-siswa');
    if (searchInput) searchInput.addEventListener('input', (e) => { setSearchQuery(e.target.value); renderTable(); });

    const fGuru = document.getElementById('filter-guru');
    const fMapel = document.getElementById('filter-mapel');
    const fKelas = document.getElementById('filter-kelas');
    const updateFilters = () => { setFilters(fKelas?.value || '', fMapel?.value || '', fGuru?.value || 'all'); renderTable(); };
    if(fGuru) fGuru.onchange = updateFilters;
    if(fMapel) fMapel.onchange = updateFilters;
    if(fKelas) fKelas.onchange = updateFilters;

    // 2. BOBOT NILAI
    document.getElementById('w-f')?.addEventListener('input', (e) => { weights.f = e.target.value; renderTable(); });
    document.getElementById('w-t')?.addEventListener('input', (e) => { weights.t = e.target.value; renderTable(); });
    document.getElementById('w-a')?.addEventListener('input', (e) => { weights.a = e.target.value; renderTable(); });

    // 3. FITUR CETAK PREVIEW
    const btnPrint = document.getElementById('btn-print-nilai');
    if (btnPrint) {
        btnPrint.onclick = () => {
            if (!selClass || !selSubject) {
                alert("Pilih Kelas dan Mata Pelajaran terlebih dahulu sebelum mencetak.");
                return;
            }
            window.print();
        };
    }

    // 4. FORM TAMBAH / EDIT MANUAL
    const gradeForm = document.getElementById('grade-form');
    if(gradeForm) {
        gradeForm.onsubmit = async (e) => {
            e.preventDefault();
            const appUser = getAppUser();
            let tot = parseFloat(weights.f) + parseFloat(weights.t) + parseFloat(weights.a);
            if(Math.abs(tot - 100) > 0.1) { alert(`Total bobot harus 100%. Saat ini: ${tot}%`); return; }

            const s = { 
                f1:san(document.getElementById('in-f1').value), f2:san(document.getElementById('in-f2').value), f3:san(document.getElementById('in-f3').value), 
                t1:san(document.getElementById('in-t1').value), t2:san(document.getElementById('in-t2').value), t3:san(document.getElementById('in-t3').value), 
                asaj:san(document.getElementById('in-asaj').value) 
            };
            const c = getCalc(s);
            const payload = { 
                studentName: document.getElementById('in-name').value, 
                nisn: document.getElementById('in-nisn').value, 
                teacherName: appUser.username, subject: fMapel.value, className: fKelas.value, 
                tahun: getActiveTahun(), semester: getActiveSemester(),
                scores: s, results: {avgFormative: parseFloat(c.avgFormative), avgTask:parseFloat(c.avgTask), final:parseFloat(c.final)}, 
                weightsSnapshot: weights 
            };
            try {
                await saveNewGrade(payload, editGradeId);
                gradeForm.reset(); document.getElementById('in-na').textContent = '0.0'; setEditGradeId(null);
                document.getElementById('badge-edit-mode')?.classList.add('hidden');
                document.getElementById('btn-cancel-edit')?.classList.add('hidden');
                renderTable();
            } catch (err) { alert("Gagal menyimpan data!"); }
        };
    }

    // 5. IMPORT EXCEL NILAI
    const importXlsxNilai = document.getElementById('import-xlsx-nilai');
    if (importXlsxNilai) {
        importXlsxNilai.onchange = (e) => {
            const file = e.target.files[0]; if(!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    let count = 0;
                    for(let row of json) {
                        const id = row["ID_SISTEM (JANGAN DIUBAH)"]; if(!id) continue;
                        const ns = { f1:san(row["F1"]), f2:san(row["F2"]), f3:san(row["F3"]), t1:san(row["T1"]), t2:san(row["T2"]), t3:san(row["T3"]), asaj:san(row["ASAJ"]) };
                        const c = getCalc(ns);
                        await updateDoc(doc(getGradesCollection(), id), {
                            scores: ns, results: { avgFormative: parseFloat(c.avgFormative), avgTask: parseFloat(c.avgTask), final: parseFloat(c.final) },
                            updatedAt: serverTimestamp()
                        });
                        count++;
                    }
                    await writeLog("IMPORT_NILAI_EXCEL", `Guru memperbarui ${count} data nilai untuk mapel ${selSubject} kelas ${selClass}.`);
                    alert(`Berhasil memperbarui ${count} data nilai.`); renderTable();
                } catch(err) { alert("Format file Excel tidak sesuai."); }
                e.target.value = null;
            };
            reader.readAsArrayBuffer(file);
        };
    }

    // 6. DELEGASI EVENT TABEL
    const gradesTbody = document.getElementById('grades-tbody');
    if(gradesTbody) {
        gradesTbody.addEventListener('input', (e) => {
            if(e.target.tagName === 'INPUT') {
                const tr = e.target.closest('tr');
                if (tr.id === 'row-new-grade') {
                    const inps = tr.querySelectorAll('.in-score');
                    const s = { f1:inps[0].value, f2:inps[1].value, f3:inps[2].value, t1:inps[3].value, t2:inps[4].value, t3:inps[5].value, asaj:inps[6].value };
                    document.getElementById('in-na').textContent = getCalc(s).final;
                    return;
                }
                const inps = tr.querySelectorAll('input');
                if (inps.length >= 7) {
                    const s = { f1:inps[0].value, f2:inps[1].value, f3:inps[2].value, t1:inps[3].value, t2:inps[4].value, t3:inps[5].value, asaj:inps[6].value };
                    const cellNa = tr.querySelector('.cell-na');
                    if (cellNa) {
                        const finVal = getCalc(s).final;
                        const isRemed = parseFloat(finVal) < 75;
                        cellNa.innerHTML = (isRemed ? '<i class="ph ph-warning-circle text-red-500 mr-1"></i>' : '') + finVal;
                    }
                }
            }
        });

        gradesTbody.addEventListener('focusout', async (e) => {
            if(e.target.tagName === 'INPUT') {
                const tr = e.target.closest('tr'); if (tr.id === 'row-new-grade') return;
                const id = tr.dataset.id; const item = gradesData.find(g=>g.id===id); if(!item) return;
                const field = e.target.dataset.f; const val = e.target.value;
                if(item.scores[field] == val) return;
                const ns = { ...item.scores, [field]: san(val) }; const c = getCalc(ns);
                try {
                    await updateDoc(doc(getGradesCollection(), id), {
                        scores: ns, results: {avgFormative: parseFloat(c.avgFormative), avgTask:parseFloat(c.avgTask), final:parseFloat(c.final)},
                        updatedAt: serverTimestamp()
                    });
                } catch(err) { console.error("Gagal Auto-Save", err); }
            }
        });

        gradesTbody.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit');
            const btnDel = e.target.closest('.btn-del');
            if (btnEdit) {
                const tr = btnEdit.closest('tr'); const id = tr.dataset.id;
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
                const tr = btnDel.closest('tr'); const id = tr.dataset.id;
                const item = gradesData.find(g => g.id === id);
                if (item && confirm(`Hapus data nilai siswa "${item.studentName}"?`)) {
                    const backupDataJSON = JSON.stringify(item);
                    deleteDoc(doc(getGradesCollection(), id)).then(async () => { 
                        await writeLog("HAPUS_NILAI_GURU", `Menghapus nilai: ${item.studentName}. Backup: ${backupDataJSON}`);
                        renderTable(); 
                    });
                }
            }
        });
    }
}
