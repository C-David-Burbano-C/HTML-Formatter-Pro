/** Ejemplos "desordenados" usados por el botón "Cargar ejemplo" para mostrar el formateador en acción. */

export const SAMPLE_HTML = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
    <title>Panel de Control</title>
<style>
.card{background:#fff;border-radius:8px;padding:16px}
  .card   .title  { font-weight:600;color:#111 }
</style>
</head>
<body>
<div class="app" data-theme="dark">
<header class="topbar"><h1>Mi Panel</h1><nav><a href="#">Inicio</a> <a href="#">Ajustes</a></nav></header>

<main>
<div class="flex items-center gap-3 rounded-xl border border-gray-200 bg-gradient-to-r from-indigo-50 to-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow duration-200">
<svg class="h-5 w-5 shrink-0 text-indigo-500"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
<span>Prueba la opción "Compactar atributo único largo": este div y el svg de arriba tienen un solo atributo (class y d) muy largo, actívala o desactívala para ver la diferencia.</span>
</div>

<section class="card">
<p class="title">Bienvenido de nuevo, <b>Ana</b>. Aquí tienes un resumen de tu actividad reciente en la plataforma durante los últimos siete días.</p>

<ul>
<li>3 tareas completadas</li>
<li>1 tarea pendiente</li>
</ul>

<form>
<input type="text" placeholder="Escribe tu nombre completo aquí" required class="input input-lg" data-testid="name-field">
<button type="submit" disabled>Guardar</button>
</form>
</section>
</main>

<script>
const state={count:0};function increment(){state.count+=1;render()}function render(){document.querySelector('.count').textContent=state.count}
</script>
</div>
</body></html>`;

export const SAMPLE_TS = `interface   Usuario{id:number;nombre:string;activo?:boolean}

class   ServicioUsuarios {
    private usuarios:Usuario[]=[]

  constructor(private http:any){}

    async cargar(  ) {
        const res=await this.http.get('/api/usuarios')
        this.usuarios=res.data
        return this.usuarios.filter(u=>u.activo===true).map(u=>({...u,nombre:u.nombre.trim()}))
    }
}
`;
