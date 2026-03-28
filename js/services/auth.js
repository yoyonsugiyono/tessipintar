// File: js/services/auth.js

import { signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, getUsersCollection } from '../config/firebase.js';

export let appUser = null;
export let USERS_DB = [];
export let activeTahun = '';
export let activeSemester = '';

const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// FUNGSI BARU: Mengecek & memulihkan sesi dari Local Storage
export function restoreSession() {
    const storedUser = localStorage.getItem('sipintar_user');
    const storedTahun = localStorage.getItem('sipintar_tahun');
    const storedSemester = localStorage.getItem('sipintar_semester');
    
    if (storedUser && storedTahun && storedSemester) {
        appUser = JSON.parse(storedUser);
        activeTahun = storedTahun;
        activeSemester = storedSemester;
        return appUser;
    }
    return null;
}

export async function setupAuth(onReady) {
    const btnLoginSubmit = document.getElementById('btn-login-submit');
    const loginErr = document.getElementById('login-error');
    const loginErrTxt = document.getElementById('login-error-text');

    try {
        console.log("[DEBUG] Mencoba otentikasi ke server...");
        if (initialToken) await signInWithCustomToken(auth, initialToken);
        else await signInAnonymously(auth);
    } catch (e) {
        console.error("[DEBUG] GAGAL OTENTIKASI", e);
        if(loginErr) { loginErr.classList.remove('hidden'); loginErr.classList.add('flex'); }
        if(loginErrTxt) loginErrTxt.innerHTML = `<b>Akses Database Ditolak!</b><br>Pesan Error: ${e.message}`;
        if(btnLoginSubmit) btnLoginSubmit.textContent = "AKSES DITOLAK";
    }

    onAuthStateChanged(auth, async user => {
        if (user) {
            console.log(`[DEBUG] Terotentikasi di Firebase. UID: ${user.uid}`);
            await loadUsersFromDB();
            if (onReady) onReady(user);
        } else {
            console.log("[DEBUG] Firebase Auth Terputus.");
        }
    });
}

export async function loadUsersFromDB() {
    const btnLoginSubmit = document.getElementById('btn-login-submit');
    const loginErr = document.getElementById('login-error');
    const loginErrTxt = document.getElementById('login-error-text');
    const usersList = document.getElementById('users-list');

    try {
        console.log("[DEBUG] Membaca koleksi akun dari Firebase...");
        const snap = await getDocs(getUsersCollection());

        if (snap.empty) {
            if(loginErr) { loginErr.classList.remove('hidden'); loginErr.classList.add('flex'); }
            if(loginErrTxt) loginErrTxt.innerHTML = `<b>Data Pengguna Kosong!</b><br>Belum ada akun di database.`;
            if(btnLoginSubmit) btnLoginSubmit.textContent = "DATABASE KOSONG";
        } else {
            USERS_DB = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
            if (usersList) usersList.innerHTML = USERS_DB.map(u => `<option value="${u.username}">`).join('');
            
            if(btnLoginSubmit) {
                btnLoginSubmit.disabled = false;
                btnLoginSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
                btnLoginSubmit.textContent = "MASUK SISTEM";
            }
        }
    } catch (err) {
        console.error("[DEBUG] GAGAL MENGAMBIL DATA PENGGUNA", err);
        if(loginErr) { loginErr.classList.remove('hidden'); loginErr.classList.add('flex'); }
        if(loginErrTxt) loginErrTxt.innerHTML = `<b>Gagal Membaca Database!</b><br>${err.message}`;
        if(btnLoginSubmit) btnLoginSubmit.textContent = "GAGAL MEMUAT DATA";
    }
}

export function initLoginForm(onLoginSuccess) {
    const loginForm = document.getElementById('login-form');
    const togglePass = document.getElementById('toggle-password');
    const loginPass = document.getElementById('login-password');

    if (togglePass && loginPass) {
        togglePass.onclick = () => {
            const type = loginPass.type === 'password' ? 'text' : 'password';
            loginPass.type = type;
            togglePass.innerHTML = type === 'password' ? '<i class="ph ph-eye"></i>' : '<i class="ph ph-eye-slash"></i>';
        };
    }

    if (loginForm) {
        loginForm.onsubmit = (e) => {
            e.preventDefault();
            const un = document.getElementById('login-username').value;
            const pw = loginPass.value;
            const u = USERS_DB.find(x => x.username === un && x.password === pw);

            if (u) {
                appUser = u;
                activeTahun = document.getElementById('login-tahun').value;
                activeSemester = document.getElementById('login-semester').value;
                document.getElementById('login-error').classList.add('hidden');
                
                // SIMPAN KE LOCAL STORAGE
                localStorage.setItem('sipintar_user', JSON.stringify(u));
                localStorage.setItem('sipintar_tahun', activeTahun);
                localStorage.setItem('sipintar_semester', activeSemester);

                if (onLoginSuccess) onLoginSuccess(u);
            } else {
                const loginErr = document.getElementById('login-error');
                loginErr.classList.remove('hidden');
                loginErr.classList.add('flex');
                document.getElementById('login-error-text').textContent = "Username atau Password salah.";
            }
        };
    }
}

export function handleLogout(onLogoutComplete) {
    appUser = null;
    activeTahun = '';
    activeSemester = '';
    
    // HAPUS DARI LOCAL STORAGE SAAT KELUAR
    localStorage.removeItem('sipintar_user');
    localStorage.removeItem('sipintar_tahun');
    localStorage.removeItem('sipintar_semester');

    document.getElementById('login-form').reset();
    if (onLogoutComplete) onLogoutComplete();
}

export const getAppUser = () => appUser;
export const getActiveTahun = () => activeTahun;
export const getActiveSemester = () => activeSemester;
