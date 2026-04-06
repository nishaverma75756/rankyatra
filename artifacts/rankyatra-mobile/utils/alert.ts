export type AlertButtonStyle = "default" | "cancel" | "destructive";
export type AlertType = "success" | "error" | "confirm" | "info" | "warning";

export type AppAlertButton = {
  text: string;
  style?: AlertButtonStyle;
  onPress?: () => void;
};

export type AppAlertConfig = {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
  type?: AlertType;
};

type AlertState = AppAlertConfig & { visible: boolean };

type SetStateFn = (fn: (prev: AlertState) => AlertState) => void;

let _setState: SetStateFn | null = null;

export function registerAlertSetter(fn: SetStateFn) {
  _setState = fn;
}

export function unregisterAlertSetter() {
  _setState = null;
}

export function showAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  type?: AlertType
) {
  if (_setState) {
    _setState(() => ({
      visible: true,
      title,
      message,
      buttons: buttons ?? [{ text: "OK" }],
      type: type ?? "info",
    }));
  }
}

export function showSuccess(title: string, message?: string, onOk?: () => void) {
  showAlert(title, message, [{ text: "OK", onPress: onOk }], "success");
}

export function showError(title: string, message?: string, onOk?: () => void) {
  showAlert(title, message, [{ text: "OK", onPress: onOk }], "error");
}

export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type?: AlertType
) {
  showAlert(
    title,
    message,
    [
      { text: cancelText, style: "cancel" },
      { text: confirmText, onPress: onConfirm },
    ],
    type ?? "confirm"
  );
}
