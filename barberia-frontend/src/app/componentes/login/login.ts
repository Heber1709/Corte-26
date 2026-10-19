import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
@Component({ selector: 'app-login', templateUrl: './login.html', styleUrls: ['./login.css'] })
export class LoginComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
  ) {}
  ngOnInit() {
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
