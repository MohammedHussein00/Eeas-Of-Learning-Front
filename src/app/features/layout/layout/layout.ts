// shared/layout/layout.ts
import { Component, Input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header, HeaderVariant } from '../header/header';
import { Footer } from '../footer/footer';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './layout.html',
  styleUrls: ['./layout.scss'],
})
export class Layout {
  @Input() variant: HeaderVariant = 'public';
}