import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleRoute({ allowedRole }) {
  const { currentUser, userRole } = useAuth();

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  // If the user's role doesn't match the route's allowed role, bounce them
  if (userRole && userRole !== allowedRole) {
    return <Navigate to={`/${userRole.toLowerCase()}/dashboard`} replace />;
  }

  // Proceed to nested routes
  return <Outlet />;
}
