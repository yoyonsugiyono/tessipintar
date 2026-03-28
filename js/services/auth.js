// File: js/services/auth.js

import { signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, getUsersCollection } from '../config/firebase.js';

// Global State untuk User
export let appUser = null;
export let USERS_DB = [];
export let activeTahun = '';
export let activeSemester = '';

const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

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
        loginErr.classList.remove('hidden');
        loginErr.classList.add('flex');
        loginErrTxt.innerHTML = `<b>Akses Database Ditolak!</b><br>Pesan Error: ${e.message}`;
        btnLoginSubmit.textContent = "AKSES DITOLAK";
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
        console.log("[DEBUG] Membaca koleksi akun (users) dari Firebase...");
        const snap = await getDocs(getUsersCollection());

        if (snap.empty) {
            loginErr.classList.remove('hidden');
            loginErr.classList.add('flex');
            loginErrTxt.innerHTML = `<b>Data Pengguna Kosong!</b><br>Belum ada akun di database.`;
            btnLoginSubmit.textContent = "DATABASE KOSONG";
        } else {
            USERS_DB = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
            
            // Masukkan ke datalist untuk autocomplete
            if (usersList) {
                usersList.innerHTML = USERS_DB.map(u => `<option value="${u.username}">`).join('');
            }

            // Aktifkan tombol
            btnLoginSubmit.disabled = false;
            btnLoginSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
            btnLoginSubmit.textContent = "MASUK SISTEM";
        }
    } catch (err) {
        console.error("[DEBUG] GAGAL MENGAMBIL DATA PENGGUNA", err);
        loginErr.classList.remove('hidden');
        loginErr.classList.add('flex');
        loginErrTxt.innerHTML = `<b>Gagal Membaca Database!</b><br>${err.message}`;
        btnLoginSubmit.textContent = "GAGAL MEMUAT DATA";
    }
}

export function initLoginForm(onLoginSuccess) {
    const loginForm = document.getElementById('login-form');
    const togglePass = document.getElementById('toggle-password');
    const loginPass = document.getElementById('login-password');

    // Fitur Show/Hide Password
    if (togglePass && loginPass) {
        togglePass.onclick = () => {
            const type = loginPass.type === 'password' ? 'text' : 'password';
            loginPass.type = type;
            togglePass.innerHTML = type === 'password' ? '<i class="ph ph-eye"></i>' : '<i class="ph ph-eye-slash"></i>';
        };
    }

    // Submit form login
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
    document.getElementById('login-form').reset();
    
    if (onLogoutComplete) onLogoutComplete();
}
