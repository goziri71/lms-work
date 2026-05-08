/**
 * Academic level for an enrollment is defined on the catalog row: courses.course_level (+ program_id).
 */
export function levelStringFromCourse(course) {
  if (course == null) return null;
  const raw =
    typeof course.get === "function"
      ? course.get("course_level")
      : course.course_level;
  if (raw === null || raw === undefined || raw === "") return null;
  return String(raw).substring(0, 5);
}
