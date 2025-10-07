import React from 'react';
import { Chatbot } from '../components/Chatbot';

export default function ChatPage() {
  return (
    <div className="fixed inset-0 bg-white">{/* Fullscreen takeover - no header/footer */}
      <Chatbot forceOpen={true} fullScreen={true} openInPageOnMobile={false} />
    </div>
  );
}


