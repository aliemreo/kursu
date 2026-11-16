import { isMockMode } from '../../services';

/** Mock mod açıkken her sayfada görünür; gerçek veri olduğu yanılgısını önler. */
export function MockBanner() {
  if (!isMockMode) return null;

  return (
    <div className="mock-banner" role="note">
      <span className="mock-banner__dot" aria-hidden="true" />
      <span>
        <strong>Mock mod</strong> · Veriler bu tarayıcıda saklanır; rakip ve hakem sahte kurallarla
        yanıt verir.
      </span>
    </div>
  );
}
