import { isMockMode } from '../../services';

/** Mock mod açıkken her sayfada görünür; gerçek veri olduğu yanılgısını önler. */
export function MockBanner() {
  if (!isMockMode) return null;

  return (
    <div className="mock-banner" role="note">
      <strong>Mock mod açık.</strong> Veriler bu tarayıcıda saklanır ve gerçek backend'e bağlı
      değilsiniz. Rakip yanıtları ve hakem kararları geliştirme amacıyla sahte kurallarla üretilir.
    </div>
  );
}