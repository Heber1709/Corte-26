import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}
  login(email: string, password: string = '') {
    return this.http
      .post<any>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((r) => this.saveToken(r.accessToken)));
  }
  register(name: string, email: string, password: string) {
    return this.http.post<{message: string}>(`${environment.apiUrl}/auth/register`, { name, email, password });
  }
  acceptRegistration(token: string) {
    return this.http.post<{message: string}>(`${environment.apiUrl}/auth/accept-registration`, { token });
  }
  saveToken(token: string) {
    localStorage.setItem('jwt_token', token);
    localStorage.removeItem('token');
  }
  getToken() {
    return localStorage.getItem('jwt_token') || localStorage.getItem('token');
  }
  payload(): any {
    try {
      return jwtDecode(this.getToken() || '');
    } catch {
      return null;
    }
  }
  getUserRole() {
    return this.payload()?.role || null;
  }
  isLoggedIn() {
    return (this.payload()?.exp || 0) * 1000 > Date.now();
  }
  logout() {
    ['jwt_token', 'token', 'role'].forEach((k) => localStorage.removeItem(k));
    this.router.navigate(['/login']);
  }
}
