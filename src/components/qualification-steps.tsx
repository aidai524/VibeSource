import {
  CheckIcon,
  CodeIcon,
  ProvenanceIcon,
  RunIcon,
} from "@/components/icons";
import type { CriterionIcon } from "@/lib/content";
import { eligibilityCriteria } from "@/lib/content";

function CriterionSymbol({ icon }: { readonly icon: CriterionIcon }) {
  if (icon === "code") {
    return <CodeIcon />;
  }

  if (icon === "run") {
    return <RunIcon />;
  }

  return <ProvenanceIcon />;
}
export function QualificationSteps() {
  return (
    <ol className="qualificationSteps" aria-label="产品收录要求">
      {eligibilityCriteria.map((criterion) => (
        <li className="qualificationStep" key={criterion.id}>
          <span className="qualificationStep__index" aria-hidden="true">
            {criterion.index}
          </span>
          <span className="qualificationStep__icon" aria-hidden="true">
            <CriterionSymbol icon={criterion.icon} />
          </span>
          <span className="qualificationStep__mobileNode" aria-hidden="true">
            <CheckIcon />
          </span>
          <span className="qualificationStep__content">
            <strong>{criterion.title}</strong>
            <span className="qualificationStep__description">
              {criterion.description}
            </span>
            <span className="qualificationStep__requirement">
              {criterion.requirement}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
