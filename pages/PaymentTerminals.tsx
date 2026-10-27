import React from 'react';
import { PaymentTerminalsSection } from '../components/settings/PaymentTerminalsSection';

const PaymentTerminals: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <PaymentTerminalsSection />
    </div>
  );
};

export default PaymentTerminals;
