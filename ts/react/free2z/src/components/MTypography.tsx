import { Typography } from "@mui/material"

export default function (variant: string) {
    return function MTypography(props: any) {
        return (
            <Typography
                component="div"
                style={{ margin: "0.5em 0" }}
                variant={variant}
                {...props}
            />
        )
    }
}