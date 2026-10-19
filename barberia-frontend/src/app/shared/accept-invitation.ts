import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api, errorMessage } from '../core/services/api';
import { AuthService } from '../core/services/auth';
import { environment } from '../../environments/environment';
@Component({ selector: 'app-accept-invitation', standalone: true,
  template: `<section class="workspace"><h2>Invitación de administrador</h2>
    <p>Para aceptar, inicia sesión con el correo de Google que recibió la invitación.</p>
    @if (message()) { <p role="status">{{ message() }}</p> }
    @if (!done()) {
      @if (!auth.isLoggedIn()) { <button class="btn-hero-red" (click)="login()">Continuar con Google</button> }
      @else { <button class="btn-hero-red" [disabled]="busy() || !token" (click)="accept()">{{ busy() ? 'Aceptando…' : 'Aceptar solicitud' }}</button>
        <button class="btn-hero-outline" (click)="login()">Usar otra cuenta de Google</button> }
    } @else { <button class="btn-hero-red" (click)="dashboard()">Ir al dashboard</button> }
  </section>`, styleUrls: ['../componentes/dashboard/dashboard.css','./forms.css'] })
export class AcceptInvitation {
  token = ''; busy = signal(false); done = signal(false); message = signal('');
  constructor(private api: Api, public auth: AuthService, private router: Router) {
    const incoming = new URLSearchParams(location.hash.slice(1)).get('invitation');
    if (incoming && /^[a-f0-9]{64}$/.test(incoming)) sessionStorage.setItem('adminInvitation', incoming);
    this.token = sessionStorage.getItem('adminInvitation') || '';
    history.replaceState(null, '', location.pathname);
    if (!this.token) this.message.set('Abre el enlace que recibiste por correo.');
  }
  login() { window.location.href = environment.apiUrl + '/auth/google'; }
  accept() {
    if (this.busy() || !this.token) return;
    this.busy.set(true);
    this.api.post('/users/administrators/accept', { token: this.token }).subscribe({
      next: () => { this.busy.set(false); this.done.set(true); this.message.set('Solicitud aceptada. Tu acceso de administrador está activo.'); sessionStorage.removeItem('adminInvitation'); },
      error: e => { this.busy.set(false); this.message.set(errorMessage(e)); }
    });
  }
  dashboard() { this.router.navigate(['/dashboard']); }
}
