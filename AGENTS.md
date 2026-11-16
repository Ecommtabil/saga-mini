<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Profit comparisons reuse DreModel metrics in a dedicated helper and share PVM filters; marketplace views stop at after-tax contribution because fixed expenses are not channel-attributed.
- PowerPoint statements use a dedicated presentation helper backed by buildDre and DreModel; each store uses its own revenue for AV and only its attributed fixed expenses, preserving dashboard calculations.
- PowerPoint negative-product lists group by store/channel/SKU with monthly store tax and no fixed-cost allocation, then paginate the entire monetary-margin ranking so losses are not masked by other scopes.
