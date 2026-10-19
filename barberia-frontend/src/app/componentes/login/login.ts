import { HAIRCUT_CATALOG } from '../../shared/haircut-catalog';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
@Component({ selector: 'app-login', templateUrl: './login.html', styleUrls: ['./login.css'] })
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild('loginDialog') loginDialog!: ElementRef<HTMLDialogElement>;
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
