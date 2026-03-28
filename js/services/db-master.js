// File: js/services/db-master.js

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getSettingsCollection } from '../config/firebase.js';

// Nilai Default jika database kosong
export let MASTER_SUBJECTS = ["Pendidikan Agama Islam","PPKn","Bahasa Indonesia","Matematika","Bahasa Inggris","Seni Tari","PJOK","Fisika","Biologi","Kimia","Sejarah","Geografi","Ekonomi","Sosiologi","Informatika","Bahasa Madura","Matematika Tingkat Lanjut","Bahasa Inggris Tingkat Lanjut"];
export let MASTER_CLASSES = ["X-1", "X-2", "X-3", "X-4", "X-5", "X-6", "X-7", "XI-A1", "XI-A2", "XI-B1", "XI-B2", "XI-B3", "XII-A1", "XII-A2", "XII-B1", "XII-B2", "XII-C"];

export async function loadMasterData() {
    try {
        const docRef = doc(getSettingsCollection(), 'master');
        const snap = await getDoc(docRef);
        
        if(snap.exists()) {
            const data = snap.data();
            if(data.subjects) MASTER_SUBJECTS = data.subjects;
            if(data.classes) MASTER_CLASSES = data.classes;
            console.log("[DEBUG] Berhasil memuat Master Data dari Firebase.");
        } else {
            console.log("[DEBUG] Master Data kosong, membuat default...");
            await setDoc(docRef, { subjects: MASTER_SUBJECTS, classes: MASTER_CLASSES });
        }
    } catch (err) {
        console.error("[DEBUG] GAGAL MEMUAT MASTER DATA", err);
    }
}

export async function saveMasterData(newSubjects, newClasses) {
    try {
        MASTER_SUBJECTS = newSubjects;
        MASTER_CLASSES = newClasses;
        await setDoc(doc(getSettingsCollection(), 'master'), { subjects: MASTER_SUBJECTS, classes: MASTER_CLASSES });
        return true;
    } catch(err) {
        console.error("[DEBUG] Gagal menyimpan Master Data", err);
        return false;
    }
}
