SELECT
    d.id,
    d."designationName",
    d."departmentId",
    dep."departmentName",
    wt."workTypeName",
    wt."siteId",
    s."siteName"
FROM "Designation" d
LEFT JOIN "Department" dep
    ON dep.id = d."departmentId"
LEFT JOIN "WorkType" wt
    ON wt.id = dep."workTypeId"
LEFT JOIN "Site" s
    ON s.id = wt."siteId"
ORDER BY d.id;