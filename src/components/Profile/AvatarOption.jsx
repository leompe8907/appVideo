import AppIcon from '../AppIcon';

/**
 * Miniatura seleccionable de avatar, usada tanto en `CreateProfileModal`
 * (crear perfil) como en `EditProfileModal` (editar perfil) -- extraída acá
 * para no duplicar el mismo componente en los dos modales.
 */
export function AvatarOption({ img, selected, onSelect, disabled }) {
  const handleClick = () => {
    if (!disabled) onSelect();
  };

  const handleKeyDown = (e) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={`create-profile-avatar-option ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={img.id.toString()}
    >
      <img src={img.img} alt="" className="create-profile-avatar-img" />
      {selected && (
        <span className="create-profile-avatar-check" aria-hidden="true">
          <AppIcon name="done" size={18} />
        </span>
      )}
    </div>
  );
}

export default AvatarOption;
