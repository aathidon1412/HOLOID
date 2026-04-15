import { useLocation, Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="text-6xl font-bold text-foreground">404</h1>
      <p className="mt-4 text-muted-foreground">
        Page not found: <code className="text-sm">{location.pathname}</code>
      </p>
      <Link to="/login" className="mt-6 text-primary hover:underline">
        Back to Login
      </Link>
    </div>
  );
};

export default NotFound;
