const API_URL = 'http://127.0.0.1:8000'; // Ajustá si tu Django corre en otro puerto

// ---- ESTADO DE LA APP ----
let isLoginMode = true;

// ---- REFERENCIAS DOM ----
const authView = document.getElementById('auth-view');
const mainView = document.getElementById('main-view');
const moviesSection = document.getElementById('movies-section');
const statsSection = document.getElementById('stats-section');
const authForm = document.getElementById('auth-form');
const movieForm = document.getElementById('movie-form');
const authError = document.getElementById('auth-error');

// ---- INICIALIZACIÓN ----
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Listeners navegación
    document.getElementById('nav-movies').addEventListener('click', () => switchMainView('movies'));
    document.getElementById('nav-stats').addEventListener('click', () => {
        switchMainView('stats');
        loadStats();
    });

    // Listeners auth toggle
    document.getElementById('btn-show-login').addEventListener('click', (e) => toggleAuthMode(true, e.target));
    document.getElementById('btn-show-register').addEventListener('click', (e) => toggleAuthMode(false, e.target));
});

// ---- AUTENTICACIÓN ----
function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (token) {
        authView.classList.add('hidden');
        mainView.classList.remove('hidden');
        loadMovies();
    } else {
        authView.classList.remove('hidden');
        mainView.classList.add('hidden');
    }
}

function toggleAuthMode(login, btn) {
    isLoginMode = login;
    document.getElementById('btn-show-login').className = login ? "text-white border-b-2 border-red-500 pb-1" : "text-gray-400 pb-1";
    document.getElementById('btn-show-register').className = !login ? "text-white border-b-2 border-red-500 pb-1" : "text-gray-400 pb-1";
    document.getElementById('auth-submit').textContent = login ? "Entrar" : "Registrarse";
    authError.classList.add('hidden');
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const endpoint = isLoginMode ? '/token/' : '/register/';

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            // DRF SimpleJWT y tu endpoint /register/ devuelven los tokens en diferentes estructuras
            const access = data.access || (data.tokens && data.tokens.access);
            const refresh = data.refresh || (data.tokens && data.tokens.refresh);
            
            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);
            authForm.reset();
            checkAuth();
        } else {
            authError.textContent = data.detail || data.error || "Credenciales inválidas o error en el registro.";
            authError.classList.remove('hidden');
        }
    } catch (err) {
        authError.textContent = "Error de conexión con el servidor.";
        authError.classList.remove('hidden');
    }
});

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    checkAuth();
}

// ---- NÚCLEO: PETICIONES API ----
async function fetchWithAuth(endpoint, options = {}) {
    let token = localStorage.getItem('access_token');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    let res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    // Lógica básica para atrapar token expirado (opcional: implementar refresh acá)
    if (res.status === 401) {
        logout();
        alert("Tu sesión expiró. Volvé a ingresar.");
        throw new Error("No autorizado");
    }
    return res;
}

// ---- CARGAR Y RENDERIZAR PELÍCULAS ----
async function loadMovies() {
    try {
        const res = await fetchWithAuth('/movie-list/');
        const movies = await res.json();
        const grid = document.getElementById('movies-grid');
        grid.innerHTML = '';

        movies.forEach(movie => {
            grid.innerHTML += `
                <div class="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 flex flex-col">
                    <img src="${movie.poster}" alt="${movie.title}" class="w-full h-80 object-cover border-b border-gray-700">
                    <div class="p-4 flex flex-col flex-grow">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="text-lg font-bold truncate pr-2">${movie.title}</h3>
                            <span class="bg-yellow-500 text-black px-2 py-0.5 rounded text-sm font-bold shrink-0">★ ${movie.calificacion}</span>
                        </div>
                        <p class="text-gray-400 text-sm mb-3">${movie.duration_minutes} min</p>
                        <p class="text-gray-300 text-sm italic mb-4 flex-grow line-clamp-3" title="${movie.descripcion}">"${movie.descripcion}"</p>
                        <button onclick='openEditModal(${JSON.stringify(movie).replace(/'/g, "&#39;")})' class="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium transition mt-auto">
                            Editar
                        </button>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error("Error cargando películas", err);
    }
}

// ---- CARGAR ESTADÍSTICAS ----
async function loadStats() {
    try {
        const res = await fetchWithAuth('/resumen/');
        const statsContent = document.getElementById('stats-content');
        
        if (res.status === 404) {
            statsContent.innerHTML = `<p class="text-center italic">No hay información suficiente todavía.</p>`;
            return;
        }

        const data = await res.json();
        statsContent.innerHTML = `
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-gray-700 p-4 rounded-lg">
                    <p class="text-gray-400 text-xs uppercase">Películas Vistas</p>
                    <p class="text-3xl font-black">${data.peliculas_vistas}</p>
                </div>
                <div class="bg-gray-700 p-4 rounded-lg">
                    <p class="text-gray-400 text-xs uppercase">Nota Media</p>
                    <p class="text-3xl font-black text-yellow-500">${data.nota_media}</p>
                </div>
                <div class="col-span-2 bg-gray-700 p-4 rounded-lg">
                    <p class="text-gray-400 text-xs uppercase">Tiempo Invertido</p>
                    <p class="text-lg font-semibold">${data.tiempo_invertido}</p>
                </div>
            </div>
            <div class="space-y-3 bg-gray-700 p-4 rounded-lg">
                <p><span class="text-green-400 font-bold">Favoritas:</span> ${data.top_mejores}</p>
                <p><span class="text-red-400 font-bold">Peores:</span> ${data.top_peores}</p>
                <hr class="border-gray-600">
                <p class="text-sm"><span class="font-bold text-gray-400">Más larga:</span> ${data.pelicula_mas_larga}</p>
                <p class="text-sm"><span class="font-bold text-gray-400">Más corta:</span> ${data.pelicula_mas_corta}</p>
            </div>
        `;
    } catch (err) {
        console.error("Error cargando estadísticas", err);
    }
}

// ---- SUBIR Y EDITAR ----
movieForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('movie-id').value;
    
    const payload = {
        title: document.getElementById('m-title').value,
        poster: document.getElementById('m-poster').value,
        duration_minutes: parseInt(document.getElementById('m-duration').value),
        calificacion: parseInt(document.getElementById('m-rating').value),
        descripcion: document.getElementById('m-desc').value,
    };

    const isEdit = id !== "";
    const endpoint = isEdit ? `/movie-edit/${id}/` : '/subir/';
    const method = isEdit ? 'PATCH' : 'POST';

    try {
        const res = await fetchWithAuth(endpoint, {
            method: method,
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeModal('modal-movie');
            loadMovies();
        } else {
            alert("Error al guardar la película. Revisá los datos.");
        }
    } catch (err) {
        console.error(err);
    }
});

// ---- CONTROL DE VISTAS Y MODALES ----
function switchMainView(view) {
    if (view === 'movies') {
        moviesSection.classList.remove('hidden');
        statsSection.classList.add('hidden');
    } else {
        moviesSection.classList.add('hidden');
        statsSection.classList.remove('hidden');
    }
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('modal-title').textContent = "Nueva Película";
    movieForm.reset();
    document.getElementById('movie-id').value = "";
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function openEditModal(movie) {
    document.getElementById('modal-movie').classList.remove('hidden');
    document.getElementById('modal-title').textContent = "Editar Película";
    
    document.getElementById('movie-id').value = movie.id;
    document.getElementById('m-title').value = movie.title;
    document.getElementById('m-poster').value = movie.poster;
    document.getElementById('m-duration').value = movie.duration_minutes;
    document.getElementById('m-rating').value = movie.calificacion;
    document.getElementById('m-desc').value = movie.descripcion;
}


// ---- NÚCLEO: PETICIONES API (CON AUTO-REFRESH) ----
async function fetchWithAuth(endpoint, options = {}) {
    let token = localStorage.getItem('access_token');
    
    // Configuramos los headers iniciales
    const getHeaders = (accessToken) => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
    });

    let res = await fetch(`${API_URL}${endpoint}`, { 
        ...options, 
        headers: getHeaders(token) 
    });

    // Si el token expiró, atajamos el 401 e intentamos renovarlo
    if (res.status === 401) {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (refreshToken) {
            try {
                // Le pegamos a tu endpoint de refresh
                const refreshRes = await fetch(`${API_URL}/token/refresh/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh: refreshToken })
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    
                    // Guardamos el nuevo access token
                    localStorage.setItem('access_token', data.access);
                    
                    // Reintentamos la petición original con el token fresquito
                    return await fetch(`${API_URL}${endpoint}`, { 
                        ...options, 
                        headers: getHeaders(data.access) 
                    });
                }
            } catch (err) {
                console.error("Fallo la renovación del token en segundo plano", err);
            }
        }
        
        // Si no hay refresh token, o el refresh token también expiró, lo limpiamos y lo fletamos al login
        logout();
        alert("Tu sesión expiró definitivamente. Volvé a ingresar.");
        throw new Error("No autorizado");
    }
    
    return res;
}