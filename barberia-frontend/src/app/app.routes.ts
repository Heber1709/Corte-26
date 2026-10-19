import { AcceptInvitation } from './shared/accept-invitation';
import { Routes } from '@angular/router';
import { LoginComponent } from './componentes/login/login';
import { DashboardComponent } from './componentes/dashboard/dashboard';
import { Clientes } from './componentes/clientes/clientes';
import { Gestion } from './componentes/gestion/gestion';
import { authGuard } from './core/auth.guard';
import { superAdminGuard } from './core/super-admin.guard';
import { Administration } from './shared/administration';
export const routes: Routes = [
  { path: 'aceptar-invitacion', component: AcceptInvitation },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'administracion', component: Administration, canActivate: [superAdminGuard] },
  { path: 'clientes', component: Clientes, canActivate: [authGuard] },
  ...['barberos', 'servicios', 'citas', 'fidelizacion'].map((page) => ({
    path: page,
    component: Gestion,
    data: { page },
    canActivate: [authGuard],
  })),
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
