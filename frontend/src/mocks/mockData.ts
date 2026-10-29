import type { MetricSnapshot, Topic } from '../types/api';

/** Yalnızca mock modu için. Gerçek kullanıcı bilgisi değildir. */
export const DEMO_USER = {
  displayName: 'Demo Öğrenci',
  email: 'demo@kursu.test',
  password: 'demo12345',
};

export const MOCK_TOPICS: Topic[] = [
  {
    id: 'school-digital-devices',
    title: 'Okullarda Dijital Cihaz Kullanımının Sınırlandırılması',
    category: 'Eğitim',
    summary: 'Ders saatlerinde kişisel dijital cihaz kullanımının sınırlandırılıp sınırlandırılmayacağı tartışılıyor.',
    positions: {
      for: 'Ders saatlerinde kişisel dijital cihaz kullanımı sınırlandırılmalıdır.',
      against: 'Dijital cihazlar eğitimin ayrılmaz bir parçasıdır ve genel bir yasakla kısıtlanmamalıdır.',
    },
  },
  {
    id: 'city-bike-lanes',
    title: 'Yeni Caddelerde Bisiklet Yolu Zorunluluğu',
    category: 'Ulaşım',
    summary: 'Yeni yapılan ana caddelerde bisiklet yolu inşasının yasal zorunluluk haline getirilmesi tartışılıyor.',
    positions: {
      for: 'Yeni yapılan ana caddelerde bisiklet yolu zorunlu tutulmalıdır.',
      against: 'Bisiklet yolu kararları yerel ihtiyaçlara göre belediyelere bırakılmalıdır.',
    },
  },
  {
    id: 'mandatory-internship',
    title: 'Üniversitelerde Zorunlu Staj Uygulamasının Kaldırılması',
    category: 'Eğitim',
    summary: 'Lisans programlarındaki zorunlu staj şartının kaldırılması ve isteğe bağlı hale getirilmesi tartışılıyor.',
    positions: {
      for: 'Zorunlu staj kaldırılmalı, öğrenciler isteğe bağlı staj yapabilmelidir.',
      against: 'Zorunlu staj, öğrencilerin mesleki deneyim kazanması için korunmalıdır.',
    },
  },
  {
    id: 'open-municipal-data',
    title: 'Belediyelerin Açık Veri Yayınlamasının Zorunlu Tutulması',
    category: 'Yönetim',
    summary: 'Belediyelerin bütçe ve ihale verilerini makine tarafından okunabilir biçimde yayınlaması tartışılıyor.',
    positions: {
      for: 'Belediyeler bütçe ve ihale verilerini açık veri olarak yayınlamakla yükümlü olmalıdır.',
      against: 'Veri yayını maliyetli olabilir; yayın kapsamı belediyelerin takdirine bırakılmalıdır.',
    },
  },
  {
    id: 'market-food-surplus',
    title: 'Market Gıda Fazlalarının Bağışlanmasının Teşvik Edilmesi',
    category: 'Çevre',
    summary: 'Gıda israfını azaltmak için market fazlalarının bağışlanmasının vergi teşviki ile desteklenmesi tartışılıyor.',
    positions: {
      for: 'Market gıda fazlaları bağışlandığında vergi teşviki sağlanmalıdır.',
      against: 'Teşvikler yerine gıda güvenliği standartları öncelikli olarak uygulanmalıdır.',
    },
  },
];

export const INITIAL_METRICS: MetricSnapshot = {
  social_cohesion: 50,
  economic_stability: 50,
  institutional_trust: 50,
};

export const METRIC_BOUNDS = { min: 0, max: 100 } as const;

/** Tek bir hakem kararında bir metriğin değişebileceği en büyük mutlak değer. */
export const MAX_DELTA = 10;

/** Her münazarada toplam tur sayısı (oyuncu + rakip). */
export const TURNS_PER_SESSION = 4;

export const MAX_TURN_LENGTH = 1200;

/** Mock rakibin argüman şablonları. Savunulan tez, şablonun sonuna eklenir. */
export const OPPONENT_ARGUMENTS: string[] = [
  'Karşı tarafın önerisi kısa vadeli kazanımlara odaklanıyor; uzun vadeli etkileri ve uygulama maliyetlerini yeterince değerlendirmiyor.',
  'Tartışmanın merkezindeki soruya döndüğümüzde, savunduğumuz tez somut örneklerle desteklenebilir ve farklı toplumsal gruplar üzerindeki etkileri daha dengeli biçimde ele alınabilir.',
];

export const VERDICT_CATEGORIES: string[] = [
  'Kanıt kalitesi',
  'Tutarlılık',
  'Karşı argümanlara yanıt',
  'Uygulanabilirlik',
  'Etik gerekçelendirme',
];