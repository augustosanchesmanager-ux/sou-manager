import React from 'react';
import { Navigate } from 'react-router-dom';

const Financial: React.FC = () => {
  return <Navigate to="/cashflow" replace />;
};

export default Financial;
