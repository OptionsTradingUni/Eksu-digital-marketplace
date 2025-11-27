export function hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  const durations = {
    light: 10,
    medium: 25,
    heavy: 50
  };

  try {
    navigator.vibrate(durations[type]);
  } catch {
  }
}

export function hapticSuccess() {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  try {
    navigator.vibrate([10, 50, 20]);
  } catch {
  }
}

export function hapticError() {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  try {
    navigator.vibrate([50, 30, 50, 30, 50]);
  } catch {
  }
}

export function hapticNotification() {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  try {
    navigator.vibrate([30, 50, 30]);
  } catch {
  }
}
