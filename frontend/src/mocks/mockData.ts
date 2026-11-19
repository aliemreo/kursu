import type { GameConfig, Topic } from '../types/api';

/** Yalnızca mock modu için. Gerçek kullanıcı bilgisi değildir. */
export const DEMO_USER = {
  username: 'demo',
  email: 'demo@kursu.test',
  password: 'demo12345',
};

/** Backend'deki geçici katalogla (backend/app/content.py) aynı konular. */
export const MOCK_TOPICS: Topic[] = [
  {
    id: 'public-transport',
    title: 'Toplu taşıma',
    motion: 'Büyükşehirlerde toplu taşıma öğrencilere ücretsiz olmalıdır.',
    positions: {
      for: 'Ücretsiz toplu taşıma eğitime erişimi kolaylaştırır.',
      against: 'Kaynaklar hat ve sefer sayısını artırmaya ayrılmalıdır.',
    },
  },
  {
    id: 'renewable-energy',
    title: 'Yenilenebilir enerji',
    motion: 'Yeni enerji yatırımlarının yarısı yenilenebilir kaynaklara ayrılmalıdır.',
    positions: {
      for: 'Yenilenebilir enerji dışa bağımlılığı azaltır.',
      against: 'Kota yerine maliyet ve arz güvenliği esas alınmalıdır.',
    },
  },
  {
    id: 'remote-work',
    title: 'Uzaktan çalışma',
    motion: 'Kamuda haftada iki gün uzaktan çalışma hakkı tanınmalıdır.',
    positions: {
      for: 'Uzaktan çalışma verimliliği ve şehir trafiğini iyileştirir.',
      against: 'Kamu hizmetinin yüz yüze sunulması önceliklidir.',
    },
  },
  {
    id: 'school-meals',
    title: 'Okul yemeği',
    motion: 'İlkokullarda tüm öğrencilere ücretsiz öğle yemeği verilmelidir.',
    positions: {
      for: 'Ücretsiz yemek beslenmeyi ve okula devamı artırır.',
      against: 'Destek yalnızca ihtiyacı olan ailelere yöneltilmelidir.',
    },
  },
  {
    id: 'urban-green',
    title: 'Kentsel yeşil alan',
    motion:
      'Belediyeler imar planlarında kişi başına asgari yeşil alanı iki katına çıkarmalıdır.',
    positions: {
      for: 'Yeşil alan halk sağlığını ve yaşam kalitesini artırır.',
      against: 'Konut arzı ve arsa maliyetleri öncelikli tutulmalıdır.',
    },
  },
];

export const MOCK_METRICS = [
  { id: 'social_cohesion', name: 'Toplumsal uyum', min: 0, max: 100, initial: 50 },
  { id: 'economic_stability', name: 'Ekonomik istikrar', min: 0, max: 100, initial: 50 },
  { id: 'institutional_trust', name: 'Kurumlara güven', min: 0, max: 100, initial: 50 },
] as const;

export const MOCK_GAME_CONFIG: GameConfig = {
  min_sessions: 1,
  max_sessions: MOCK_TOPICS.length,
  rounds_per_session: 3,
  max_turn_length: 4000,
  catalog_version: 'mock-0.1',
};

/** Tek bir hakem kararında bir metriğin değişebileceği en büyük mutlak değer. */
export const MAX_DELTA = 10;

/** Mock rakibin argüman şablonları. Savunulan tez, şablonun sonuna eklenir. */
export const OPPONENT_ARGUMENTS: string[] = [
  'Karşı tarafın önerisi kısa vadeli kazanımlara odaklanıyor; uzun vadeli etkileri ve uygulama maliyetlerini yeterince değerlendirmiyor.',
  'Tartışmanın merkezindeki soruya döndüğümüzde, savunduğumuz tez somut örneklerle desteklenebilir ve farklı toplumsal gruplar üzerindeki etkileri daha dengeli biçimde ele alınabilir.',
  'Kapanışta şunu vurgulamak isterim: öneri, kaynakların en çok ihtiyaç duyulan yere yönlendirilmesi ilkesiyle bağdaşmalıdır.',
];
