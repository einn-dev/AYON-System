import React, { useEffect, useState } from 'react';
import './Account.css';

/* The round profile picture. Shows the uploaded photo, or the person's
   initials when there is no photo (or the photo cannot be loaded). */
/* Stored files are private: a picture saved in our storage is shown through the server,
   which gives profile pictures to anyone ("…/storage/v1/object/public/<bucket>/avatars/<name>"). */
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const pictureUrl = (u) => {
  const m = String(u || '').match(/\/storage\/v1\/object\/public\/[^/]+\/avatars\/([\w-]+\.(?:png|jpe?g|webp))(?:\?.*)?$/i);
  return m ? `${API_BASE}/files/avatar/${m[1]}` : u;
};

const Avatar = ({ user, src, size = 36 }) => {
  const url = pictureUrl(src !== undefined ? src : user?.avatar_url);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [url]);

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {url && !broken
        ? <img src={url} alt="" onError={() => setBroken(true)} />
        : initials}
    </div>
  );
};

export default Avatar;