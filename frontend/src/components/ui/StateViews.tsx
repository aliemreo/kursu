import { Alert } from './Alert';
import { Button } from './Button';
import { Spinner } from './Spinner';

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="state state--loading" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Alert tone="error" title="Bir sorun oluştu">
      <p>{message}</p>
      {onRetry && (
        <div style={{ marginTop: 10 }}>
          <Button variant="secondary" onClick={onRetry}>
            Tekrar dene
          </Button>
        </div>
      )}
    </Alert>
  );
}