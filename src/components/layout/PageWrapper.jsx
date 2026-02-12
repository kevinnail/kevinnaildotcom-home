import useScrollToTop from '../../hooks/useScrollToTop';

export default function PageWrapper({ children }) {
  useScrollToTop();
  return <>{children}</>;
}
