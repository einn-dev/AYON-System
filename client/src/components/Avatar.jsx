import React, { useEffect, useState } from 'react';
import './Account.css';

/* The round profile picture. Shows the uploaded photo, or the person's
   initials when there is no photo (or the photo cannot be loaded). */
const Avatar = ({ user, src, size = 36 }) => {
  const url = src !== undefined ? src : user?.avatar_url;
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