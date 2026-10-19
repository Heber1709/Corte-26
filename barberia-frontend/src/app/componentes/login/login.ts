import { FormsModule } from '@angular/forms';
import { HAIRCUT_CATALOG } from '../../shared/haircut-catalog';
import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
@Component({ imports: [FormsModule], selector: 'app-login', templateUrl: './login.html', styleUrls: ['./login.css', './account.css'] })
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('loginDialog') loginDialog!: ElementRef<HTMLDialogElement>;
  mode: 'login' | 'register' = 'login';
  email = ''; password = ''; name = ''; message = ''; busy = false;
  registrationToken = '';
  ngAfterViewInit() {
    setTimeout(() => {
      this.registrationToken = new URLSearchParams(this.route.snapshot.fragment || '').get('registration') || '';
      if (this.registrationToken) { this.openLogin(); history.replaceState(null, '', location.pathname); }
    });
  }
  switchMode() { this.mode = this.mode === 'login' ? 'register' : 'login'; this.message = ''; this.password = ''; }
  submitAccount() {
    if (this.busy) return;
    this.busy = true; this.message = '';
    const request = this.mode === 'register' ? this.auth.register(this.name, this.email, this.password) : this.auth.login(this.email, this.password);
    request.subscribe({ next: (result) => {
      this.busy = false; this.password = '';
      if (this.mode === 'register') this.message = result.message;
      else { this.closeLogin(); this.router.navigate([sessionStorage.getItem('adminInvitation') ? '/aceptar-invitacion' : '/dashboard']); }
    }, error: (error) => { this.busy = false; this.message = typeof error.error?.message === 'string' ? error.error.message : 'No se pudo completar. Inténtalo nuevamente.'; } });
  }
  acceptRegistration() {
    if (this.busy) return;
    this.busy = true;
    this.auth.acceptRegistration(this.registrationToken).subscribe({ next: result => {
      this.busy = false; this.registrationToken = ''; this.mode = 'login'; this.message = result.message;
    }, error: error => { this.busy = false; this.message = error.error?.message || 'No se pudo aceptar la invitación.'; } });
  }
  cuts = ['ref-01.jpg', 'ref-17.png', 'ref-32.jpg'].map(file => HAIRCUT_CATALOG.find(cut => cut.image.endsWith(file))!);
  cutNames = ['Degradado impecable', 'Clásico con carácter', 'Textura & volumen'];
  cutTags = ['LIMPIO · PRECISO · ACTUAL', 'VERSÁTIL · DEFINIDO · PERSONAL', 'MOVIMIENTO · CONTRASTE · ESTILO'];
  private previousOverflow = '';
  private previousMargin = document.body.style.margin;
  openLogin() { this.previousOverflow = document.body.style.overflow; this.loginDialog.nativeElement.showModal(); document.body.style.overflow = 'hidden'; }
  closeLogin() { this.loginDialog.nativeElement.close(); }
  onDialogClick(event: MouseEvent) { if (event.target === this.loginDialog.nativeElement) this.closeLogin(); }
  onDialogClose() { document.body.style.overflow = this.previousOverflow; }
  ngOnDestroy() { this.onDialogClose(); document.body.style.margin = this.previousMargin; }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
  ) {}
  ngOnInit() {
    document.body.style.margin = '0';
    const token =
      new URLSearchParams(this.route.snapshot.fragment || '').get('token') ||
      this.route.snapshot.queryParamMap.get('token');
    if (token) this.auth.saveToken(token);
    if (this.auth.isLoggedIn()) this.router.navigate([sessionStorage.getItem('adminInvitation') ? '/aceptar-invitacion' : '/dashboard'], { replaceUrl: true });
  }
  loginWithGoogle() {
    window.location.href = `${environment.apiUrl}/auth/google`;
  }
}
