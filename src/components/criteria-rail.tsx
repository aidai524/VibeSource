import { eligibilityCriteria } from "@/lib/content";

export function CriteriaRail() {
  return (
    <aside className="criteriaRail" aria-labelledby="criteria-rail-title">
      <h2 id="criteria-rail-title">核验标准</h2>
      <ol>
        {eligibilityCriteria.map((criterion, index) => (
          <li key={criterion.id}>
            <span
              className={`criteriaRail__node${
                index === 0 ? " criteriaRail__node--active" : ""
              }`}
              aria-hidden="true"
            />
            <span>{criterion.title}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
