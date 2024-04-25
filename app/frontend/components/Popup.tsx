import React from 'react';
// import './Popup.css'; // Import CSS file for styling

interface PopupProps {
  onClose: () => void; // Function to close the popup
  data: string[] | null;
}

const Popup: React.FC<PopupProps> = ({ data, onClose }) => {
  return (
    <div className="popup">
      <div className="popup-content">
        <h2><strong>Review Questions</strong></h2>
        {/* Display data if available */}
        {data && data.map((item, index) => (
          <p key={index}>{item}</p>
        ))}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default Popup;
