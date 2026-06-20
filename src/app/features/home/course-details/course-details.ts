import {
  Component, inject, signal, computed, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, ElementRef, ViewChild, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService, TRANSLOCO_SCOPE } from '@ngneat/transloco';
import { firstValueFrom, Subject, filter, takeUntil } from 'rxjs';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  LucideAngularModule,
  BookOpen, Star, Users, Clock, Play, Globe, Award, ChevronDown,
  ChevronRight, CheckCircle, BarChart3, MessageSquare, ArrowLeft,
  Heart, Share2, Bookmark, Calendar, Monitor, AlertCircle,
  Building2, BadgeCheck, Sparkles, GraduationCap, ArrowRight,
  Video, Mail, Facebook, Twitter, Send, Check, Copy, X,
  FolderOpen, Smartphone, Eye, Download
} from 'lucide-angular';
import { APP_CONFIG } from '../../../core/config/app.config';

gsap.registerPlugin(ScrollTrigger);

// ── Types ───────────────────────────────────────────────────────────

interface SubjectDto {
  id: string;
  name: string;
  nameInAr: string;
  gradeLevel: string;
  gradeLevelInAr: string;
  language: string;
  questionCount: number;
  createdAt: string;
  isActive: boolean;
}

interface LecturePreviewDto {
  id: string;
  title: string;
  durationMinutes: number;
  isPreview: boolean;
  order: number;
}

interface SectionPreviewDto {
  id: string;
  title: string;
  description: string;
  order: number;
  totalLectures: number;
  totalDuration: number;
  previewLectures: LecturePreviewDto[];
}

interface CourseReviewDto {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  comment: string;
  createdFrom: string;
}

interface CoursePreviewData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  longDescription: string;
  whatYouWillLearn: string;
  requirements: string;
  imageUrl: string;
  price: number;
  discountPrice: number | null;
  isFree: boolean;
  isPublished: boolean;
  language: string;
  level: string;
  rating: number;
  ratingCount: number;
  studentCount: number;
  totalLectures: number;
  totalHours: number;
  instructorId: string;
  instructorName: string;
  instructorBio: string;
  instructorAvatar: string;
  promoVideoUrl: string;
  createdAt: string;
  publishedAt: string;
  lastUpdatedAt: string;
  isNew: boolean;
  isEnrolled: boolean;
  hasDiscount: boolean;
  currentPrice: string;
  discountPercentage: number;
  subject: SubjectDto | null;
  sectionsPreview: SectionPreviewDto[];
  reviews: CourseReviewDto[];
  isPlatformCourse?: boolean;
  isInWishlist: boolean;
  isBookmarked: boolean;
  bookmarkCollectionName?: string;
  shareCount?: number;
  wishlistCount?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors?: string[];
}

interface ShareOption {
  key: string;
  icon: any;
  label: string;
  arLabel: string;
  color: string;
}

// ── Constants ────────────────────────────────────────────────────────

const PLATFORM_INSTRUCTOR_NAMES = [
  'System Administrator',
  'EOL',
  'EOL Platform',
  'EOL Admin',
];

const SHARE_OPTIONS: ShareOption[] = [
  { key: 'copy_link', icon: Copy, label: 'Copy Link', arLabel: 'نسخ الرابط', color: '#64748b' },
  { key: 'facebook', icon: Facebook, label: 'Facebook', arLabel: 'فيسبوك', color: '#1877f2' },
  { key: 'twitter', icon: Twitter, label: 'Twitter', arLabel: 'تويتر', color: '#1da1f2' },
  { key: 'whatsapp', icon: Send, label: 'WhatsApp', arLabel: 'واتساب', color: '#25d366' },
  { key: 'email', icon: Mail, label: 'Email', arLabel: 'بريد إلكتروني', color: '#ea4335' },
];

@Component({
  selector: 'app-course-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslocoModule,
    LucideAngularModule,
  ],
  templateUrl: './course-details.html',
  styleUrls: ['./course-details.scss'],
  providers: [
    { provide: TRANSLOCO_SCOPE, useValue: 'courseDetails' },
  ],
})
export class CourseDetails implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  public route = inject(ActivatedRoute);
  public config = inject(APP_CONFIG);
  private transloco = inject(TranslocoService);

  @ViewChild('pageRef') pageRef?: ElementRef<HTMLDivElement>;
  @ViewChild('videoRef') videoRef?: ElementRef<HTMLVideoElement>;

  private destroy$ = new Subject<void>();
  private fetchedRef = false;

  // ── Icons ──────────────────────────────────────────────────────────
  readonly BookOpenIcon = BookOpen;
  readonly StarIcon = Star;
  readonly UsersIcon = Users;
  readonly ClockIcon = Clock;
  readonly PlayIcon = Play;
  readonly GlobeIcon = Globe;
  readonly AwardIcon = Award;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronRightIcon = ChevronRight;
  readonly CheckCircleIcon = CheckCircle;
  readonly BarChart3Icon = BarChart3;
  readonly MessageSquareIcon = MessageSquare;
  readonly ArrowLeftIcon = ArrowLeft;
  readonly HeartIcon = Heart;
  readonly Share2Icon = Share2;
  readonly BookmarkIcon = Bookmark;
  readonly CalendarIcon = Calendar;
  readonly MonitorIcon = Monitor;
  readonly AlertCircleIcon = AlertCircle;
  readonly Building2Icon = Building2;
  readonly BadgeCheckIcon = BadgeCheck;
  readonly SparklesIcon = Sparkles;
  readonly GraduationCapIcon = GraduationCap;
  readonly ArrowRightIcon = ArrowRight;
  readonly VideoIcon = Video;
  readonly MailIcon = Mail;
  readonly FacebookIcon = Facebook;
  readonly TwitterIcon = Twitter;
  readonly SendIcon = Send;
  readonly CheckIcon = Check;
  readonly CopyIcon = Copy;
  readonly XIcon = X;
  readonly FolderOpenIcon = FolderOpen;
  readonly SmartphoneIcon = Smartphone;
  readonly EyeIcon = Eye;
  readonly DownloadIcon = Download;

  readonly shareOptions = SHARE_OPTIONS;

  // ── State signals ──────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  course = signal<CoursePreviewData | null>(null);
  expandedSections = signal<Set<string>>(new Set());
  showFullDescription = signal(false);
  isWishlisted = signal(false);
  isBookmarked = signal(false);
  showVideoPreview = signal(false);
  showShareModal = signal(false);
  shareLinkCopied = signal(false);
  bookmarkCollectionName = signal('');
  showBookmarkModal = signal(false);
  actionLoading = signal<{ wishlist: boolean; bookmark: boolean }>({
    wishlist: false,
    bookmark: false,
  });

  private entranceCtx?: gsap.Context;

  // ── Language / RTL ─────────────────────────────────────────────────
  get isRTL(): boolean {
    return this.transloco.getActiveLang() === 'ar';
  }

  // ── Translation helper ────────────────────────────────────────────
  t(key: string): string {
    return this.transloco.translate(`courseDetails.${key}`);
  }

  // ── Computed ───────────────────────────────────────────────────────
  readonly platform = computed(() => {
    const c = this.course();
    return c ? this.checkIsPlatformCourse(c) : false;
  });

  readonly displayName = computed(() => {
    const c = this.course();
    if (!c) return 'Unknown';
    return this.platform() ? 'EOL' : (c.instructorName || 'Unknown');
  });

  readonly instructorBio = computed(() => {
    const c = this.course();
    if (!c) return null;
    if (this.platform()) {
      return this.isRTL
        ? 'دورات رسمية من إنشاء فريق منصة EOL. تعليم عالي الجودة للجميع.'
        : 'Official courses created by the EOL platform team. Quality education for everyone.';
    }
    return c.instructorBio || null;
  });

  readonly imageUrl = computed(() => {
    const c = this.course();
    return c?.imageUrl
      ? `${this.config.baseUrl}${c.imageUrl}`
      : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=500&fit=crop&auto=format';
  });

  readonly videoUrl = computed(() => {
    const c = this.course();
    if (!c?.promoVideoUrl) return '';
    return c.promoVideoUrl.startsWith('http')
      ? c.promoVideoUrl
      : `${this.config.baseUrl}${c.promoVideoUrl}`;
  });

  readonly hasVideo = computed(() => {
    const c = this.course();
    return !!c?.promoVideoUrl;
  });

  // ── Helpers ────────────────────────────────────────────────────────

  private checkIsPlatformCourse(d: CoursePreviewData): boolean {
    if (d.isPlatformCourse) return true;
    if (d.instructorName && PLATFORM_INSTRUCTOR_NAMES.some(n =>
      d.instructorName.toLowerCase().includes(n.toLowerCase())
    )) return true;
    return false;
  }

  getInitials(name: string): string {
    if (name === 'EOL') return 'EOL';
    return name
      .split(' ')
      .map(p => p.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  }

  formatDate(d?: string): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString(
      this.isRTL ? 'ar-SA' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' }
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  ngOnInit(): void {
    this.fetchedRef = false;
    this.fetchCourse();

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.fetchedRef = false;
        this.fetchCourse();
      }
    });

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.fetchedRef = false;
        this.fetchCourse();
      }
    });
  }

  ngAfterViewInit(): void {
    // Animations triggered after data loads
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.entranceCtx?.revert();
  }

  // ── Data loading ───────────────────────────────────────────────────

  private async fetchCourse(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || this.fetchedRef) return;
    this.fetchedRef = true;
    this.loading.set(true);
    this.error.set('');

    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<CoursePreviewData>>(
          `${this.config.baseUrl}/api/Courses/${id}/preview`
        ),
        { defaultValue: null }
      );

      if (res?.success) {
        const data = res.data;
        this.course.set(data);
        this.isWishlisted.set(data.isInWishlist || false);
        this.isBookmarked.set(data.isBookmarked || false);
        if (data.sectionsPreview?.length) {
          this.expandedSections.set(new Set([data.sectionsPreview[0].id]));
        }
        this.loading.set(false);
        setTimeout(() => this.animateEntrance());
      } else {
        this.error.set(res?.message || this.t('courseNotFound'));
        this.loading.set(false);
      }
    } catch (err: any) {
      const status = err?.status;
      if (status === 404) {
        this.error.set(this.t('courseNotFound'));
      } else {
        this.error.set(err?.error?.message || this.t('courseNotFound'));
      }
      this.loading.set(false);
    }
  }

  // ── Animations ─────────────────────────────────────────────────────

  private animateEntrance(): void {
    if (!this.pageRef) return;
    this.entranceCtx?.revert();
    this.entranceCtx = gsap.context(() => {
      gsap.from('.cd-hero-content > *', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out',
        delay: 0.2,
      });
      gsap.from('.cd-price-sidebar', {
        x: 40,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
        delay: 0.4,
      });
      gsap.from('.cd-content-section', {
        scrollTrigger: {
          trigger: '.cd-content-grid',
          start: 'top 85%',
        },
        y: 40,
        opacity: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power2.out',
      });
    }, this.pageRef.nativeElement);
  }

  // ── Section toggle ────────────────────────────────────────────────

  toggleSection(sectionId: string): void {
    this.expandedSections.update(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  // ── Video toggle ──────────────────────────────────────────────────

  toggleVideo(): void {
    if (!this.hasVideo()) return;
    if (this.showVideoPreview()) {
      this.videoRef?.nativeElement?.pause();
      this.showVideoPreview.set(false);
    } else {
      this.showVideoPreview.set(true);
      setTimeout(() => {
        this.videoRef?.nativeElement?.play().catch(() => {});
      }, 100);
    }
  }

  // ── Wishlist handler ──────────────────────────────────────────────

  async toggleWishlist(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (this.actionLoading().wishlist || !id) return;

    this.actionLoading.update(prev => ({ ...prev, wishlist: true }));
    try {
      if (this.isWishlisted()) {
        await firstValueFrom(
          this.http.delete(`${this.config.baseUrl}/api/Courses/${id}/wishlist`)
        );
        this.isWishlisted.set(false);
        // Message via transloco
        console.log(this.t('removeFromWishlist'));
      } else {
        await firstValueFrom(
          this.http.post(`${this.config.baseUrl}/api/Courses/${id}/wishlist`, null)
        );
        this.isWishlisted.set(true);
        console.log(this.t('addToWishlist'));
      }
    } catch {
      console.error(this.t('removeFromWishlist'));
    } finally {
      this.actionLoading.update(prev => ({ ...prev, wishlist: false }));
    }
  }

  // ── Bookmark handlers ─────────────────────────────────────────────

  async removeBookmark(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (this.actionLoading().bookmark || !id) return;

    this.actionLoading.update(prev => ({ ...prev, bookmark: true }));
    try {
      await firstValueFrom(
        this.http.delete(`${this.config.baseUrl}/api/Courses/${id}/bookmark`)
      );
      this.isBookmarked.set(false);
      console.log(this.t('removeBookmark'));
    } catch {
      console.error(this.t('removeBookmark'));
    } finally {
      this.actionLoading.update(prev => ({ ...prev, bookmark: false }));
    }
  }

  toggleBookmark(): void {
    if (this.isBookmarked()) {
      this.removeBookmark();
    } else {
      this.showBookmarkModal.set(true);
    }
  }

  async addBookmark(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (this.actionLoading().bookmark || !id) return;

    this.actionLoading.update(prev => ({ ...prev, bookmark: true }));
    try {
      await firstValueFrom(
        this.http.post(`${this.config.baseUrl}/api/Courses/${id}/bookmark`, {
          collectionName: this.bookmarkCollectionName() || 'My Courses',
        })
      );
      this.isBookmarked.set(true);
      this.showBookmarkModal.set(false);
      this.bookmarkCollectionName.set('');
      console.log(this.t('saveCourse'));
    } catch {
      console.error(this.t('saveCourse'));
    } finally {
      this.actionLoading.update(prev => ({ ...prev, bookmark: false }));
    }
  }

  // ── Share handler ─────────────────────────────────────────────────

  async shareCourse(method: string): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    const shareUrl = `${window.location.origin}/courses/${id}`;
    const c = this.course();
    const shareText = c ? `${c.title} - ${c.subtitle || ''}` : '';

    this.http.post(`${this.config.baseUrl}/api/Courses/${id}/share`, {
      shareMethod: method,
      shareUrl: shareUrl,
    }).subscribe();

    switch (method) {
      case 'copy_link':
        try {
          await navigator.clipboard.writeText(shareUrl);
          this.shareLinkCopied.set(true);
          console.log(this.t('copied'));
          setTimeout(() => this.shareLinkCopied.set(false), 3000);
        } catch {
          const textArea = document.createElement('textarea');
          textArea.value = shareUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          console.log(this.t('copied'));
        }
        break;
      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        this.showShareModal.set(false);
        break;
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        this.showShareModal.set(false);
        break;
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`;
        this.showShareModal.set(false);
        break;
      case 'whatsapp':
        window.open(
          `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
          '_blank'
        );
        this.showShareModal.set(false);
        break;
    }
  }

  // ── Enroll handler ─────────────────────────────────────────────────

  handleEnroll(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const c = this.course();
    if (!c?.isPublished || !id) return;
    if (c.isEnrolled) {
      this.router.navigate(['/courses', id, 'progress']);
    } else {
      this.router.navigate(['/checkout', id]);
    }
  }

  // ── Navigation helpers ────────────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/courses']);
  }

  navigateToInstructor(): void {
    const c = this.course();
    if (!c?.instructorId) return;
    if (this.platform()) {
      this.router.navigate(['/platform/eol']);
    } else {
      this.router.navigate(['/teachers', c.instructorId]);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────

  renderStars(rating: number, size: number = 14): { filled: boolean }[] {
    const rounded = Math.round(rating);
    return Array.from({ length: 5 }).map((_, i) => ({
      filled: i < rounded,
    }));
  }

  getLearnItems(): string[] {
    const c = this.course();
    return c?.whatYouWillLearn?.split('\n').filter(Boolean) || [];
  }

  getRequirementItems(): string[] {
    const c = this.course();
    return c?.requirements?.split('\n').filter(Boolean) || [];
  }

  getTotalPreviewLectures(): number {
    const c = this.course();
    if (!c?.sectionsPreview) return 0;
    return c.sectionsPreview.reduce(
      (acc, s) => acc + (s.previewLectures?.length || 0),
      0
    );
  }

  // ── Close modals ──────────────────────────────────────────────────

  closeShareModal(): void {
    this.showShareModal.set(false);
    this.shareLinkCopied.set(false);
  }

  closeBookmarkModal(): void {
    this.showBookmarkModal.set(false);
    this.bookmarkCollectionName.set('');
  }

  // ── Host listeners ─────────────────────────────────────────────────

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showShareModal()) {
      this.closeShareModal();
    }
    if (this.showBookmarkModal()) {
      this.closeBookmarkModal();
    }
    if (this.showVideoPreview()) {
      this.showVideoPreview.set(false);
    }
  }
  getCourseUrl(): string {
  const id = this.route.snapshot.paramMap.get('id') || '';
  return `${window.location.origin}/courses/${id}`;
}
}