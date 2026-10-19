import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Person, errorMessage } from '../core/services/api';
import { Navigation } from './navigation';

@Component({
  selector: 'app-administration',
  standalone: true,
  imports: [FormsModule, Navigation],
  template: `
    <app-navigation />
    @if (me()?.isSuperAdmin && me()?.role === 'ADMIN') {
      <section class="workspace" aria-labelledby="administration-title">
        <h2 id="administration-title">Administración de accesos</h2>
        <p>Solo tú, como superadministrador, puedes agregar administradores y cambiar sus permisos.</p>
        <p>Los permisos de gestión permiten registrar y editar en cada área. Sin permisos, la cuenta conserva las funciones de cliente.</p>
        @if (message()) { <p role="status">{{ message() }}</p> }
        @if (error()) { <p role="alert">{{ error() }}</p> }
        <form #form="ngForm" (ngSubmit)="save()">
          <div class="fields">
            <label>Nombre<input name="adminName" [(ngModel)]="name" required maxlength="100" [disabled]="busy()" /></label>
            <label>Correo de Google<input name="adminEmail" type="email" [(ngModel)]="email" required email [disabled]="busy() || editing" /></label>
          </div>
          <fieldset [disabled]="busy()">
            <legend>Permisos del administrador</legend>
            @for (permission of options; track permission.key) {
              <label class="permission"><input type="checkbox" [name]="permission.key" [(ngModel)]="selected[permission.key]" /> {{ permission.label }}</label>
            }
          </fieldset>
          <div class="actions">
            <button class="btn-hero-red" [disabled]="form.invalid || busy()">{{ editing ? 'Guardar permisos' : 'Crear y enviar invitación' }}</button>
            <button type="button" class="btn-hero-outline" [disabled]="busy()" (click)="reset()">Limpiar formulario</button>
          </div>
        </form>
        <p>Al crear un administrador se envía una invitación por correo. Sus permisos se activan cuando acepta con su cuenta de Google. El enlace vence en 48 horas.</p>
        @for (admin of admins(); track admin.id) {
          <article class="admin-row">
            <strong>{{ admin.name }}</strong> · {{ admin.email }}
            @if (admin.isSuperAdmin) { <span class="gold-badge">Superadministrador · todos los permisos</span> }
            @else {
              <button type="button" class="invitation-status" [class.accepted]="admin.adminInviteStatus === 'ACCEPTED'" [attr.aria-label]="status(admin)" aria-disabled="true">{{ status(admin) }}</button>
              <p>{{ labels(admin.permissions || []) }}</p>
              @if (admin.adminInviteStatus && admin.adminInviteStatus !== 'ACCEPTED') {
                <button type="button" class="btn-hero-outline" [disabled]="busy()" (click)="resend(admin)">Reenviar invitación</button>
              }
              <div class="actions">
                <button type="button" class="btn-hero-outline" [disabled]="busy()" (click)="edit(admin)">Editar permisos</button>
                <button type="button" class="btn-hero-outline" [disabled]="busy()" (click)="revoke(admin)">Quitar acceso / cancelar solicitud</button>
              </div>
            }
          </article>
        }
      </section>
    }
  `,
  styleUrls: ['../componentes/dashboard/dashboard.css', './forms.css'],
  styles: [':host { min-height: 0; } .invitation-status { display:block; margin:.6rem 0; padding:.5rem .8rem; border:1px solid #665848; border-radius:6px; color:#c2b7aa; background:#292520; opacity:.65; cursor:default; } .invitation-status.accepted { background:#e83254; color:white; opacity:1; border-color:#e83254; } .permission { display: inline-flex; align-items: center; gap: .5rem; margin: .5rem 1rem .5rem 0; } .permission input { width: auto; } .admin-row { padding: 1rem 0; border-bottom: 1px solid #443526; overflow-wrap: anywhere; }'],
})
export class Administration implements OnInit, OnDestroy {
  me = signal<Person | null>(null);
  admins = signal<(Person & { adminInviteStatus?: string; adminInviteExpires?: string })[]>([]);
  private refreshTimer?: ReturnType<typeof setInterval>;
  ngOnDestroy() { clearInterval(this.refreshTimer); }
  status(admin: any) {
    if (admin.adminInviteStatus === 'ACCEPTED') return 'Solicitud aceptada';
    if (admin.adminInviteStatus === 'FAILED') return 'Error de envío';
    if (admin.adminInviteExpires && new Date(admin.adminInviteExpires).getTime() < Date.now()) return 'Solicitud vencida';
    if (admin.adminInviteStatus === 'SENT') return 'Solicitud enviada';
    if (admin.adminInviteStatus === 'SENDING') return 'Enviando solicitud';
    return 'Administrador activo';
  }
  busy = signal(false);
  error = signal('');
  message = signal('');
  name = ''; email = ''; editing = false;
  selected: Record<string, boolean> = {};
  options = [
    { key: 'CLIENTS', label: 'Gestionar clientes' },
    { key: 'BARBERS', label: 'Gestionar barberos y fotos' },
    { key: 'SERVICES', label: 'Gestionar servicios' },
    { key: 'APPOINTMENTS', label: 'Gestionar citas' },
    { key: 'LOYALTY', label: 'Gestionar fidelización y reactivar clientes' },
  ];
  constructor(private api: Api) {}
  ngOnInit() {
    this.api.get<Person>('/users/me').subscribe({ next: user => { this.me.set(user); if (user.isSuperAdmin && user.role === 'ADMIN') { this.load(); this.refreshTimer = setInterval(() => { if (!document.hidden && !this.busy()) this.load(); }, 10000); } }, error: () => {} });
  }
  load() { this.api.get<Person[]>('/users/administrators').subscribe({ next: users => this.admins.set(users), error: e => this.error.set(errorMessage(e)) }); }
  reset() { this.name = ''; this.email = ''; this.selected = {}; this.editing = false; }
  edit(user: Person) { this.name = user.name; this.email = user.email; this.editing = true; this.selected = Object.fromEntries((user.permissions || []).map(p => [p, true])); this.error.set(''); }
  labels(permissions: string[]) { return this.options.filter(p => permissions.includes(p.key)).map(p => p.label).join(', ') || 'Sin permisos de gestión'; }
  save() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.api.post<any>('/users/administrators', { name: this.name.trim(), email: this.email.trim(), permissions: this.options.filter(p => this.selected[p.key]).map(p => p.key) }).subscribe({
      next: result => { this.busy.set(false); this.reset(); this.message.set(result.status === 'SENT' ? 'Solicitud enviada. El acceso se activará cuando la persona la acepte.' : 'Permisos actualizados.'); this.load(); },
      error: e => { this.busy.set(false); this.error.set(errorMessage(e)); },
    });
  }
  resend(user: Person) { this.edit(user); this.save(); }
  revoke(user: Person) {
    if (!confirm('¿Quitar el acceso de administrador a ' + user.email + '? Su cuenta seguirá como cliente.')) return;
    this.busy.set(true); this.error.set('');
    this.api.delete('/users/administrators/' + user.id).subscribe({ next: () => { this.busy.set(false); this.reset(); this.message.set('Acceso de administrador retirado'); this.load(); }, error: e => { this.busy.set(false); this.error.set(errorMessage(e)); } });
  }
}
