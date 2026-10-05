import { resolveFormulaAsset, type FormulaPresentation } from "./formulaAssets";
import type { VisualTyreCompound } from "./carVisualState";
import {
  getFormulaMaterial,
  getFormulaMaterialFor,
  teamLivery,
  type FormulaLiveryId,
} from "./formulaLivery";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { createFormulaVisual } from "./formulaVisual";
class ModelBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function LoadedFormula({
  livery,
  teamColor,
  compound,
  presentation,
}: {
  livery: FormulaLiveryId;
  teamColor?: string;
  compound: VisualTyreCompound;
  presentation: FormulaPresentation;
}) {
  const { scene } = useGLTF(resolveFormulaAsset(presentation).asset.url, false);
  const visual = useMemo(
    () =>
      createFormulaVisual(
        scene,
        teamColor
          ? getFormulaMaterialFor(teamLivery(teamColor), compound)
          : getFormulaMaterial(livery, compound),
      ),
    [scene, livery, teamColor, compound],
  );
  // Geometry belongs to useGLTF; materials belong to the livery cache, not drivers.
  return <primitive object={visual} dispose={null} />;
}
export default function FormulaCar({
  fallback,
  livery = "svl-development",
  teamColor,
  compound = "UNKNOWN",
  presentation = "standard",
}: {
  fallback: ReactNode;
  livery?: FormulaLiveryId;
  /** Team colour livery (driver views); overrides `livery` when set. */
  teamColor?: string;
  compound?: VisualTyreCompound;
  presentation?: FormulaPresentation;
}) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedFormula
          livery={livery}
          teamColor={teamColor}
          compound={compound}
          presentation={presentation}
        />
      </Suspense>
    </ModelBoundary>
  );
}
