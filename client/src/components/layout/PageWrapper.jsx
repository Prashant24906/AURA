import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function PageWrapper({ title, children }) {
  return (
    <div className="page-wrapper">
      <Sidebar />
      <div className="main-content">
        <Topbar title={title} />
        <div className="page-body">
          {children}
        </div>
      </div>
    </div>
  );
}
