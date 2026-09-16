import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>', // Esto le dice que pinte tu LoginComponent aquí
})
export class AppComponent {
  title = 'barberia-frontend';
}