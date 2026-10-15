import type { InputHTMLAttributes } from "react";
import { Input as ArcInput } from "../components/arc/input/input.js";
import "../styles/uiarc-scoped.css";
import "../styles/token.css";

/** Contract adapter: existing field labels stay visible in FormField; Arc renders the input. */
export function SopInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const label = typeof props["aria-label"] === "string" ? props["aria-label"] : "Field";
  return <ArcInput {...props} compact label={label} />;
}
