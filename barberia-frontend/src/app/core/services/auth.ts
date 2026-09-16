import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { jwtDecode } from 'jwt-decode';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private router: Router) { }

  // 1. Usamos el endpoint de desarrollo que creamos para simular el inicio de sesión
  login(email: string) {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, { email }).pipe(
      tap(response => {
        if (response.accessToken) {
          this.saveToken(response.accessToken);
        }
      })
    );
  }

  // 2. Guardar token en el navegador
  private saveToken(token: string): void {
    localStorage.setItem('jwt_token', token);
  }

  // 3. Obtener token del navegador
  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  // 4. Leer el rol del token (útil para saber a qué dashboard enviarlo)
  getUserRole(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const decoded: any = jwtDecode(token);
      return decoded.role;
    } catch (Error) {
      return null;
    }
  }

  // 5. Verificar si hay sesión activa
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // 6. Cerrar sesión
  logout(): void {
    localStorage.removeItem('jwt_token');
    this.router.navigate(['/login']);
  }
}