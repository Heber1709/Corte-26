import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule], // Necesario para los inputs del HTML
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  email: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  onLogin() {
    if (!this.email) {
      alert('Por favor ingresa un correo');
      return;
    }

    this.authService.login(this.email).subscribe({
      next: (response) => {
        console.log('Respuesta de la API:', response);
        const role = this.authService.getUserRole();
        
        alert(`¡Login exitoso! Tu token se ha guardado. \nTu rol es: ${role}`);
        
        // Aquí redirigiremos a los dashboards más adelante:
        // if (role === 'CLIENT') this.router.navigate(['/dashboard-cliente']);
      },
      error: (error) => {
        console.error('Error al iniciar sesión:', error);
        alert('Hubo un error de conexión con el backend.');
      }
    });
  }
}