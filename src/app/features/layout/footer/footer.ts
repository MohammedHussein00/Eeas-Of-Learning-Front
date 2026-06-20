// shared/components/footer/footer.ts
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { Language } from '../../../core/services/language';
import {
  LucideAngularModule,
  GraduationCap,
  Heart,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Mail,
  MapPin,
  Phone,
} from 'lucide-angular';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  head: string;
  links: FooterLink[];
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './footer.html',
  styleUrls: ['./footer.scss'],
})
export class Footer {
  private router   = inject(Router);
  private language = inject(Language);

  // Lucide icons
  readonly GraduationCapIcon = GraduationCap;
  readonly HeartIcon         = Heart;
  readonly FacebookIcon      = Facebook;
  readonly TwitterIcon       = Twitter;
  readonly InstagramIcon     = Instagram;
  readonly LinkedinIcon      = Linkedin;
  readonly YoutubeIcon       = Youtube;
  readonly MailIcon          = Mail;
  readonly MapPinIcon        = MapPin;
  readonly PhoneIcon         = Phone;

  isRtl = this.language.isRtl;
  currentYear = new Date().getFullYear();

  cols = computed<FooterColumn[]>(() => {
    const ar = this.isRtl();
    return [
      {
        head: ar ? 'المنصة' : 'Platform',
        links: [
          { label: ar ? 'تصفح الدورات' : 'Browse Courses', href: '/courses' },
          { label: ar ? 'الإرشاد' : 'Mentorship', href: '/mentorship' },
          { label: ar ? 'الأسعار' : 'Pricing', href: '/pricing' },
          { label: ar ? 'للأعمال' : 'For Business', href: '/business' },
          { label: ar ? 'كن مدرباً' : 'Become Instructor', href: '/teach' },
        ],
      },
      {
        head: ar ? 'الموارد' : 'Resources',
        links: [
          { label: ar ? 'المدونة' : 'Blog', href: '/blog' },
          { label: ar ? 'مركز المساعدة' : 'Help Center', href: '/help' },
          { label: ar ? 'المجتمع' : 'Community', href: '/community' },
          { label: ar ? 'الندوات' : 'Webinars', href: '/webinars' },
          { label: ar ? 'الشهادات' : 'Certificates', href: '/certs' },
        ],
      },
      {
        head: ar ? 'الشركة' : 'Company',
        links: [
          { label: ar ? 'من نحن' : 'About Us', href: '/about' },
          { label: ar ? 'الوظائف' : 'Careers', href: '/careers' },
          { label: ar ? 'تواصل معنا' : 'Contact', href: '/contact' },
          { label: ar ? 'سياسة الخصوصية' : 'Privacy Policy', href: '/privacy' },
          { label: ar ? 'شروط الاستخدام' : 'Terms of Service', href: '/terms' },
        ],
      },
    ];
  });

  socials = [
    { Icon: this.FacebookIcon, href: '#' },
    { Icon: this.TwitterIcon, href: '#' },
    { Icon: this.InstagramIcon, href: '#' },
    { Icon: this.LinkedinIcon, href: '#' },
    { Icon: this.YoutubeIcon, href: '#' },
  ];

  contactInfo = computed(() => [
    { icon: this.MailIcon, text: 'hello@eolplatform.com' },
    { icon: this.PhoneIcon, text: '+20 100 000 0000' },
    { icon: this.MapPinIcon, text: this.isRtl() ? 'القاهرة، مصر' : 'Cairo, Egypt' },
  ]);

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}